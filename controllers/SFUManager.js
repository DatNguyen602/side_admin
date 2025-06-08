const mediasoup = require("mediasoup");
const { v4: uuidv4 } = require("uuid");
const User = require("./models/User"); // Import model User

class SFUManager {
    constructor() {
        this.workers = [];
        this.routers = new Map();
    }

    async createWorker() {
        const worker = await mediasoup.createWorker();
        worker.on("died", () => console.error(`Worker died: ${worker.pid}`));
        this.workers.push(worker);
        return worker;
    }

    async createSFU() {
        const worker =
            this.workers.length > 0
                ? this.workers[0]
                : await this.createWorker();

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

        // Mỗi router có userContexts map
        router.userContexts = new Map();

        const sfuId = uuidv4();
        this.routers.set(sfuId, router);

        console.log(`Created SFU with ID ${sfuId}`);

        return { sfuId, router };
    }

    getRouter(sfuId) {
        return this.routers.get(sfuId);
    }

    async addUserToSFU(sfuId, userId) {
        const router = this.getRouter(sfuId);
        if (!router) throw new Error("Router not found");

        if (!router.userContexts.has(userId)) {
            const user = await User.findById(userId).lean();
            if (!user) throw new Error("User not found");

            // Update User state
            await User.findByIdAndUpdate(userId, {
                state: "online",
                lastSeen: new Date(),
            });

            router.userContexts.set(userId, {
                userId,
                userInfo: user,
                transports: new Map(),
                producers: new Map(),
                consumers: new Map(),
                joinTime: new Date(),
            });

            console.log(`User ${userId} joined SFU ${sfuId}`);
        }
    }

    async removeUserFromSFU(sfuId, userId) {
        const router = this.getRouter(sfuId);
        if (!router) throw new Error("Router not found");

        const userContext = router.userContexts.get(userId);
        if (!userContext) return;

        // Close all transports → auto close producer/consumer
        for (const transport of userContext.transports.values()) {
            transport.close();
        }

        router.userContexts.delete(userId);

        // Update User state
        await User.findByIdAndUpdate(userId, {
            state: "offline",
            lastSeen: new Date(),
        });

        console.log(`User ${userId} left SFU ${sfuId}`);
    }

    async createWebRtcTransport(sfuId, userId, transportOptions = {}) {
        const router = this.getRouter(sfuId);
        if (!router) throw new Error("Router not found");

        const userContext = router.userContexts.get(userId);
        if (!userContext) throw new Error("User not in SFU");

        const transport = await router.createWebRtcTransport({
            listenIps: [{ ip: "0.0.0.0", announcedIp: "YOUR_PUBLIC_IP" }], // ← đổi thành public IP thật của server
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            ...transportOptions,
        });

        const transportId = uuidv4();
        userContext.transports.set(transportId, transport);

        transport.on("close", () => {
            userContext.transports.delete(transportId);
        });

        console.log(
            `Created transport ${transportId} for user ${userId} in SFU ${sfuId}`
        );

        return { transportId, transport };
    }

    async createProducer(sfuId, userId, transportId, kind, rtpParameters) {
        const router = this.getRouter(sfuId);
        if (!router) throw new Error("Router not found");

        const userContext = router.userContexts.get(userId);
        if (!userContext) throw new Error("User not in SFU");

        const transport = userContext.transports.get(transportId);
        if (!transport) throw new Error("Transport not found");

        const producer = await transport.produce({ kind, rtpParameters });

        const producerId = uuidv4();
        userContext.producers.set(producerId, producer);

        producer.on("close", () => {
            userContext.producers.delete(producerId);
        });

        console.log(
            `Created producer ${producerId} for user ${userId} in SFU ${sfuId}`
        );

        return { producerId, producer };
    }

    async createConsumer(
        sfuId,
        userId,
        transportId,
        producerUserId,
        producerId,
        rtpCapabilities
    ) {
        const router = this.getRouter(sfuId);
        if (!router) throw new Error("Router not found");

        const userContext = router.userContexts.get(userId);
        if (!userContext) throw new Error("User not in SFU");

        const transport = userContext.transports.get(transportId);
        if (!transport) throw new Error("Transport not found");

        const producerContext = router.userContexts.get(producerUserId);
        if (!producerContext) throw new Error("Producer user not in SFU");

        const producer = producerContext.producers.get(producerId);
        if (!producer) throw new Error("Producer not found");

        if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
            throw new Error("Cannot consume this producer");
        }

        const consumer = await transport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: false,
        });

        const consumerId = uuidv4();
        userContext.consumers.set(consumerId, consumer);

        consumer.on("close", () => {
            userContext.consumers.delete(consumerId);
        });

        console.log(
            `Created consumer ${consumerId} for user ${userId} in SFU ${sfuId}, consuming producer ${producerId}`
        );

        return { consumerId, consumer };
    }

    async closeSFU(sfuId) {
        const router = this.getRouter(sfuId);
        if (!router) return;

        // Close all transports for all users
        for (const userContext of router.userContexts.values()) {
            for (const transport of userContext.transports.values()) {
                transport.close();
            }
        }

        await router.close();
        this.routers.delete(sfuId);

        console.log(`Router ${sfuId} closed`);
    }

    getStats() {
        return {
            workerCount: this.workers.length,
            routerCount: this.routers.size,
            routers: Array.from(this.routers.entries()).map(
                ([sfuId, router]) => ({
                    sfuId,
                    userCount: router.userContexts.size,
                })
            ),
        };
    }
}

module.exports = new SFUManager();
