#!/usr/bin/env node

const { LMStudioClient } = require("@lmstudio/sdk");
const inquirer = require("inquirer");
const chalk = require("chalk");
const ora = require("ora");
const fs = require("fs-extra");
const readline = require("readline");
const path = require("path");
const say = require("say");

// ==== CẤU HÌNH ==== //
const LOG_FILE = "chat-history.txt";
const CONFIG_PATH = "config.json";
const BANNER_PATH = path.join("assets", "banner.txt");
const PROMPT_FOLDER = "prompts";

const AVAILABLE_MODELS = ["llama-3.2-1b-instruct", "tinyllama-1.1b-chat-v1.0"];

let CONFIG = {
    temperature: 0.3,
    maxTokens: 1024,
    top_p: 0.95,
    frequencyPenalty: 0.2,
    presencePenalty: 0.4,
};

let model = null;
let selectedModel = null;
let systemPrompt = "Bạn là một trợ lý AI hữu ích.";
let lastPrompt = "";
let lastAnswer = "";
let enableTTS = false;
let isDevMode = false;
let conversationHistory = [];

const client = new LMStudioClient();

// ==== QUẢN LÝ CẤU HÌNH ==== //
async function loadConfig() {
    if (await fs.pathExists(CONFIG_PATH)) {
        const saved = await fs.readJson(CONFIG_PATH);
        CONFIG = saved.CONFIG || CONFIG;
        systemPrompt = saved.systemPrompt || systemPrompt;
        console.log(chalk.cyan("📦 Đã tải cấu hình từ config.json"));
    }
}

async function saveConfig() {
    await fs.writeJson(CONFIG_PATH, { CONFIG, systemPrompt }, { spaces: 2 });
}

// ==== CHỌN & TẢI MÔ HÌNH ==== //
async function selectModel() {
    const { modelName } = await inquirer.prompt([
        {
            type: "list",
            name: "modelName",
            message: "🔍 Chọn mô hình:",
            choices: AVAILABLE_MODELS,
            default: AVAILABLE_MODELS[0],
        },
    ]);
    selectedModel = modelName;
}

async function loadModel() {
    const spinner = ora(`🔄 Đang tải mô hình ${selectedModel}...`).start();
    try {
        model = await client.llm.model(selectedModel);
        spinner.succeed(
            `✅ Mô hình "${chalk.green(selectedModel)}" đã sẵn sàng.`
        );
    } catch (err) {
        spinner.fail("❌ Không thể tải mô hình.");
        console.error(err);
        process.exit(1);
    }
}

// ==== GỬI PROMPT ==== //
async function askModel(prompt) {
    const spinner = ora("💭 Đang suy nghĩ...").start();
    const startTime = Date.now();

    try {
        conversationHistory.push({ role: "user", content: prompt });

        const result = await model.respond(
            [{ role: "system", content: systemPrompt }, ...conversationHistory],
            CONFIG
        );

        spinner.stop();

        if (!result?.content) {
            console.log(chalk.red("⚠️ Không có nội dung trả về."));
            return;
        }

        conversationHistory.push({
            role: "assistant",
            content: result.content,
        });
        lastAnswer = result.content;

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const timestamp = new Date().toLocaleString();
        const logEntry = `🕒 [${timestamp}]\n🧑 Ask: ${prompt}\n🤖 Ans: ${result.content}\n⏱️ Time: ${elapsed}s\n`;
        await fs.appendFile(LOG_FILE, logEntry + "\n", "utf8");

        console.log(chalk.cyan("\n📋 Phản hồi:"));
        console.log(chalk.whiteBright(result.content));
        console.log(
            chalk.gray(
                `⏱️ Thời gian: ${elapsed}s | 🔠 Token: ${
                    result.usage?.completionTokens || "?"
                }`
            )
        );

        if (enableTTS) say.speak(result.content);
        if (isDevMode) console.log(chalk.gray("\n🧪 Raw response:"), result);
    } catch (err) {
        spinner.fail("❌ Lỗi phản hồi:");
        console.error(err);
    }
}

// ==== LỆNH ==== //
function showHelp() {
    console.log(
        chalk.blue(`
🔧 Lệnh hỗ trợ:
--exit        Thoát chương trình
--clear       Xoá prompt trước
--retry       Gửi lại prompt trước
--history     Hiện 5 lịch sử gần nhất
--search      Tìm kiếm trong lịch sử
--config      Điều chỉnh cấu hình mô hình
--system      Cập nhật system prompt
--random      Gửi prompt ngẫu nhiên từ file
--tts         Bật/tắt Text-to-Speech
--reset       Xoá hội thoại hiện tại
--repeat      Hiện lại câu trả lời gần nhất
--dev         Bật Developer Mode
--help        Hiện hướng dẫn
`)
    );
}

async function showRecentHistory(limit = 5) {
    try {
        const content = await fs.readFile(LOG_FILE, "utf8");
        const entries = content
            .trim()
            .split(/\n{2,}/)
            .slice(-limit);
        console.log(chalk.magenta(`📜 ${entries.length} đoạn gần nhất:`));
        for (const entry of entries) {
            console.log(chalk.gray("-".repeat(40)));
            console.log(entry);
        }
    } catch {
        console.log(chalk.red("❌ Không thể đọc lịch sử."));
    }
}

async function searchHistory() {
    const { keyword } = await inquirer.prompt([
        { name: "keyword", message: "🔎 Từ khoá cần tìm:" },
    ]);
    const content = await fs.readFile(LOG_FILE, "utf8");
    const matches = content
        .split(/\n{2,}/)
        .filter((block) => block.includes(keyword));
    if (matches.length) {
        console.log(chalk.green(`🔍 Tìm thấy ${matches.length} đoạn:`));
        matches.forEach((entry) => console.log(chalk.gray(entry + "\n")));
    } else {
        console.log(chalk.red("❌ Không tìm thấy."));
    }
}

async function adjustConfig() {
    const configInputs = await inquirer.prompt([
        {
            name: "temperature",
            message: "🌡 Temperature (0-1):",
            default: CONFIG.temperature,
        },
        {
            name: "maxTokens",
            message: "🔢 Max Tokens:",
            default: CONFIG.maxTokens,
        },
        { name: "top_p", message: "📊 Top-p (0-1):", default: CONFIG.top_p },
        {
            name: "frequencyPenalty",
            message: "🔁 Frequency Penalty:",
            default: CONFIG.frequencyPenalty,
        },
        {
            name: "presencePenalty",
            message: "🧠 Presence Penalty:",
            default: CONFIG.presencePenalty,
        },
    ]);
    CONFIG = {
        temperature: parseFloat(configInputs.temperature),
        maxTokens: parseInt(configInputs.maxTokens),
        top_p: parseFloat(configInputs.top_p),
        frequencyPenalty: parseFloat(configInputs.frequencyPenalty),
        presencePenalty: parseFloat(configInputs.presencePenalty),
    };
    await saveConfig();
    console.log(chalk.green("✅ Đã cập nhật cấu hình."));
}

async function updateSystemPrompt() {
    const { sys } = await inquirer.prompt([
        { name: "sys", message: "🧠 Nhập system prompt mới:" },
    ]);
    systemPrompt = sys;
    await saveConfig();
    console.log(chalk.green("✅ Đã cập nhật system prompt."));
}

async function randomPrompt() {
    const files = await fs.readdir(PROMPT_FOLDER);
    const { promptFile } = await inquirer.prompt([
        {
            name: "promptFile",
            message: "📁 Chọn tập prompt:",
            type: "list",
            choices: files,
        },
    ]);
    const lines = (await fs.readFile(`${PROMPT_FOLDER}/${promptFile}`, "utf8"))
        .split(/\r?\n/)
        .filter(Boolean);
    const randomPrompt = lines[Math.floor(Math.random() * lines.length)];
    console.log(chalk.yellow(`🧪 Prompt ngẫu nhiên: ${randomPrompt}`));
    await askModel(randomPrompt);
}

// ==== PROMPT GIAO TIẾP ==== //
function startPrompt() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.green("💬 Nhập câu hỏi (hoặc lệnh): "),
    });

    rl.prompt();

    rl.on("line", async (line) => {
        const input = line.trim();
        try {
            switch (input) {
                case "--exit":
                    rl.close();
                    return;
                case "--clear":
                    lastPrompt = "";
                    console.log(chalk.gray("🧹 Prompt trước đã được xoá."));
                    break;
                case "--retry":
                    if (lastPrompt) await askModel(lastPrompt);
                    else console.log(chalk.red("⚠️ Không có prompt trước."));
                    break;
                case "--repeat":
                    if (lastAnswer) console.log(chalk.yellow(lastAnswer));
                    else
                        console.log(
                            chalk.red("⚠️ Không có câu trả lời gần nhất.")
                        );
                    break;
                case "--history":
                    await showRecentHistory();
                    break;
                case "--search":
                    await searchHistory();
                    break;
                case "--config":
                    await adjustConfig();
                    break;
                case "--system":
                    await updateSystemPrompt();
                    break;
                case "--random":
                    await randomPrompt();
                    break;
                case "--tts":
                    enableTTS = !enableTTS;
                    console.log(
                        chalk.green(`🔊 TTS ${enableTTS ? "bật" : "tắt"}`)
                    );
                    break;
                case "--dev":
                    isDevMode = !isDevMode;
                    console.log(
                        chalk.green(
                            `🧪 Developer mode ${isDevMode ? "bật" : "tắt"}`
                        )
                    );
                    break;
                case "--reset":
                    conversationHistory = [];
                    console.log(chalk.gray("🔁 Đã xoá hội thoại hiện tại."));
                    break;
                case "--help":
                    showHelp();
                    break;
                default:
                    lastPrompt = input;
                    await askModel(input);
            }
        } catch (err) {
            console.error(chalk.red("❌ Lỗi xử lý:"), err);
        }
        process.stdin.resume();
        rl.prompt();
    });

    rl.on("close", () => {
        console.log(chalk.green("\n👋 Kết thúc chương trình."));
        process.exit(0);
    });
}

// ==== KHỞI ĐỘNG ==== //
(async () => {
    try {
        await loadConfig();
        if (await fs.pathExists(BANNER_PATH)) {
            const banner = await fs.readFile(BANNER_PATH, "utf8");
            console.log(chalk.magenta(banner));
        }
        await selectModel();
        await loadModel();
        showHelp();
        startPrompt();
    } catch (err) {
        console.error(chalk.red("❌ Lỗi khởi động:"), err);
    }
})();
