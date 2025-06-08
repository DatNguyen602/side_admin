const mediasoup = require("mediasoup");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");

class SFUManager {
    constructor() {
        this.workers = [];
        this.nextWorkerIndex = 0;
        this.routers = new Map(); // sfuId → router
    }

    // Tạo worker mới
    async createWorker() {
        const worker = await mediasoup.createWorker();
        worker.on("died", () => console.error(`Worker died: ${worker.pid}`));
        this.workers.push(worker);
        return worker;
    }

    // Lấy worker theo round-robin
    async getOrCreateWorker() {
        if (this.workers.length === 0) {
            await this.createWorker();
        }
        const worker = this.workers[this.nextWorkerIndex];
        this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
        return worker;
    }

    // Tạo SFU/router mới
    async createSFU() {
        const worker = await this.getOrCreateWorker();
        const router = await worker.createRouter({
            mediaCodecs: [
                {
                    kind: "audio",
                    mimeType: "audio/opus",
                    clockRate: 48000,
                    channels: 2,
                },
                { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
            ],
        });

        // Chuẩn bị các map
        router.userContexts = new Map(); // userId → context
        router.transports = new Map(); // transportId → transport (chung)
        router.producers = new Map(); // producerId → { producer, userId }
        router.consumers = new Map(); // consumerId → { consumer, userId }

        const sfuId = uuidv4();
        this.routers.set(sfuId, router);
        return { sfuId, router };
    }

    getRouter(sfuId) {
        return this.routers.get(sfuId);
    }

    // Thêm user vào SFU
    async addUserToSFU(sfuId, userId) {
        const router = this.getRouter(sfuId);
        if (!router) throw new Error("Router not found");
        if (router.userContexts.has(userId)) return;

        const user = await User.findById(userId).lean();
        if (!user) throw new Error("User not found");

        // Cập nhật trạng thái online
        await User.findByIdAndUpdate(userId, {
            state: "online",
            lastSeen: new Date(),
        });

        router.userContexts.set(userId, {
            transports: new Set(),
            producers: new Set(),
            consumers: new Set(),
            joinTime: new Date(),
        });
    }

    // Remove user khỏi SFU
    async removeUserFromSFU(sfuId, userId) {
        const router = this.getRouter(sfuId);
        if (!router) throw new Error("Router not found");
        const ctx = router.userContexts.get(userId);
        if (!ctx) return;

        // Close all transports (auto close producers & consumers)
        for (const tid of ctx.transports) {
            const tr = router.transports.get(tid);
            tr?.close();
        }
        router.userContexts.delete(userId);

        // Cập nhật trạng thái offline
        await User.findByIdAndUpdate(userId, {
            state: "offline",
            lastSeen: new Date(),
        });
    }

    // Tạo WebRTC transport và kết nối DTLS
    async createWebRtcTransport(sfuId, userId, options = {}) {
        const router = this.getRouter(sfuId);
        if (!router) throw new Error("Router not found");
        if (!router.userContexts.has(userId))
            throw new Error("User not in SFU");

        const transport = await router.createWebRtcTransport({
            listenIps: [{ ip: "0.0.0.0", announcedIp: process.env.PUBLIC_IP }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            ...options,
        });

        const transportId = uuidv4();
        router.transports.set(transportId, transport);
        router.userContexts.get(userId).transports.add(transportId);

        // Event logging
        transport.on("icestatechange", (s) => console.log("ICE state", s));
        transport.on("dtlsstatechange", (s) => console.log("DTLS state", s));
        transport.on("close", () => {
            router.transports.delete(transportId);
            router.userContexts.get(userId).transports.delete(transportId);
        });

        return { transportId, transport };
    }

    async connectTransport(sfuId, userId, transportId, dtlsParameters) {
        const router = this.getRouter(sfuId);
        const transport = router?.transports.get(transportId);
        if (!transport) throw new Error("Transport not found");
        await transport.connect({ dtlsParameters });
    }

    // Tạo producer (user gửi media lên)
    async createProducer(
        sfuId,
        userId,
        transportId,
        kind,
        rtpParameters,
        appData = {}
    ) {
        const router = this.getRouter(sfuId);
        const transport = router?.transports.get(transportId);
        if (!transport) throw new Error("Transport not found");

        const producer = await transport.produce({
            kind,
            rtpParameters,
            appData,
        });
        const producerId = uuidv4();
        router.producers.set(producerId, { producer, userId });
        router.userContexts.get(userId).producers.add(producerId);

        producer.on("close", () => {
            router.producers.delete(producerId);
            router.userContexts.get(userId).producers.delete(producerId);
        });
        producer.on("pause", () => console.log("Producer paused", producerId));
        producer.on("resume", () =>
            console.log("Producer resumed", producerId)
        );

        return { producerId, producer };
    }

    async pauseProducer(sfuId, producerId) {
        const rec = this.routers.get(sfuId)?.producers.get(producerId);
        if (!rec) throw new Error("Producer not found");
        await rec.producer.pause();
    }
    async resumeProducer(sfuId, producerId) {
        const rec = this.routers.get(sfuId)?.producers.get(producerId);
        if (!rec) throw new Error("Producer not found");
        await rec.producer.resume();
    }
    async closeProducer(sfuId, producerId) {
        const rec = this.routers.get(sfuId)?.producers.get(producerId);
        if (rec) rec.producer.close();
    }

    // Danh sách producers khi join
    getProducerList(sfuId, excludeUserId) {
        const router = this.getRouter(sfuId);
        const list = [];
        for (const [pid, { producer, userId }] of router.producers) {
            if (userId !== excludeUserId) {
                list.push({ producerId: pid, userId, kind: producer.kind });
            }
        }
        return list;
    }

    // Tạo consumer (user nhận media)
    async createConsumer(
        sfuId,
        userId,
        transportId,
        producerId,
        rtpCapabilities
    ) {
        const router = this.getRouter(sfuId);
        if (!router.canConsume({ producerId, rtpCapabilities })) {
            throw new Error("Cannot consume");
        }

        const transport = router.transports.get(transportId);
        const { producer } = router.producers.get(producerId);
        const consumer = await transport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: false,
        });

        const consumerId = uuidv4();
        router.consumers.set(consumerId, { consumer, userId });
        router.userContexts.get(userId).consumers.add(consumerId);

        consumer.on("close", () => {
            router.consumers.delete(consumerId);
            router.userContexts.get(userId).consumers.delete(consumerId);
        });
        consumer.on("pause", () => console.log("Consumer paused", consumerId));
        consumer.on("resume", () =>
            console.log("Consumer resumed", consumerId)
        );

        return { consumerId, consumer };
    }

    async pauseConsumer(sfuId, consumerId) {
        const rec = this.routers.get(sfuId)?.consumers.get(consumerId);
        if (!rec) throw new Error("Consumer not found");
        await rec.consumer.pause();
    }
    async resumeConsumer(sfuId, consumerId) {
        const rec = this.routers.get(sfuId)?.consumers.get(consumerId);
        if (!rec) throw new Error("Consumer not found");
        await rec.consumer.resume();
    }
    async closeConsumer(sfuId, consumerId) {
        const rec = this.routers.get(sfuId)?.consumers.get(consumerId);
        if (rec) rec.consumer.close();
    }

    // Đóng toàn bộ SFU
    async closeSFU(sfuId) {
        const router = this.getRouter(sfuId);
        if (!router) return;
        // đóng transports
        for (const tr of router.transports.values()) tr.close();
        await router.close();
        this.routers.delete(sfuId);
    }

    // Stats & monitoring
    async getStats(sfuId) {
        const router = this.getRouter(sfuId);
        if (!router) throw new Error("Router not found");
        const stats = {
            transports: {},
            producers: {},
            consumers: {},
        };
        for (const [tid, tr] of router.transports) {
            stats.transports[tid] = await tr.getStats();
        }
        for (const [pid, { producer }] of router.producers) {
            stats.producers[pid] = await producer.getStats();
        }
        for (const [cid, { consumer }] of router.consumers) {
            stats.consumers[cid] = await consumer.getStats();
        }
        return stats;
    }

    // Thống kê chung
    getSystemStats() {
        return {
            workerCount: this.workers.length,
            routerCount: this.routers.size,
            routers: Array.from(this.routers.entries()).map(
                ([sfuId, router]) => ({
                    sfuId,
                    userCount: router.userContexts.size,
                    transportCount: router.transports.size,
                    producerCount: router.producers.size,
                    consumerCount: router.consumers.size,
                })
            ),
        };
    }
}

module.exports = new SFUManager();
