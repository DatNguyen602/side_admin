// cluster.js
const cluster = require("cluster");
const os = require("os");

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
    console.log(`👑 Master PID: ${process.pid}`);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker) => {
        console.log(`❌ Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
} else {
    require("./app-entry"); // Mỗi worker chạy Express app riêng
}
