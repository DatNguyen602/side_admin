const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// === CONFIG ===
const LANG_BASE = path.join(__dirname, "..", "..", "..", "public", "langs");
const CONFIG_PATH = path.join(LANG_BASE, "lang_config.json");

// === Multer setup ===
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.originalname === "lang_config.json")
            return cb(new Error("Không cho phép upload file config"), false);
        if (path.extname(file.originalname) !== ".json")
            return cb(new Error("Chỉ cho phép upload file JSON"), false);
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/:code/upload-chunk", express.json(), async (req, res) => {
    try {
        const lang = req.params.code;
        const dirPath = path.join(LANG_BASE, lang);
        const filePath = path.join(dirPath, `main.json`);

        // ✅ Tạo thư mục nếu chưa có
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // ✅ Đảm bảo có dữ liệu ban đầu
        let existing = {};
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, "utf-8");
            try {
                existing = JSON.parse(content);
            } catch {
                existing = {};
            }
        }

        // ✅ Merge và lưu lại
        const newData = req.body; // { key: value, ... }
        const merged = { ...existing, ...newData };
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");

        res.json({ success: true });
    } catch (err) {
        console.error("❌ Error in /upload-chunk:", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:code/key/:keyName
router.delete("/:code/key/:keyName", async (req, res) => {
    try {
        const lang = req.params.code;
        const keyToDelete = req.params.keyName;

        const dirPath = path.join(LANG_BASE, lang);
        const filePath = path.join(dirPath, `main.json`);

        if (!fs.existsSync(filePath)) {
            return res
                .status(404)
                .json({ success: false, error: "Language file not found" });
        }

        const raw = fs.readFileSync(filePath, "utf-8");
        let json = {};
        try {
            json = JSON.parse(raw);
        } catch {
            return res
                .status(400)
                .json({ success: false, error: "Invalid JSON format" });
        }

        if (!(keyToDelete in json)) {
            return res
                .status(404)
                .json({ success: false, error: "Key not found" });
        }

        delete json[keyToDelete];
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf-8");

        res.json({ success: true, deleted: keyToDelete });
    } catch (err) {
        console.error("❌ Error deleting key:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// === GET download decrypted JSON ===
router.get("/:code/download", async (req, res) => {
    try {
        const lang = req.params.code;
        const filePath = path.join(LANG_BASE, lang, "main.json");

        await fs.promises.access(filePath);
        const data = await fs.promises.readFile(filePath);
        // const decrypted = decryptBuffer(data);
        const json = JSON.parse(data.toString("utf8"));

        res.setHeader(
            "Content-Disposition",
            `attachment; filename=${lang}.json`
        );
        res.json(json);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// === DELETE remove Lang ===
router.delete("/:code", async (req, res) => {
    try {
        const lang = req.params.code;
        const langPath = path.join(LANG_BASE, lang);

        if (fs.existsSync(langPath)) {
            await fs.promises.rm(langPath, { recursive: true, force: true });
            return res.json({ success: true, message: `Deleted ${lang}` });
        } else {
            return res
                .status(404)
                .json({ success: false, message: "Language folder not found" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === GET config.json ===
router.get("/config", async (req, res) => {
    try {
        const raw = await fs.promises.readFile(CONFIG_PATH, "utf8");
        res.json(JSON.parse(raw));
    } catch {
        res.json({ fallback: "" });
    }
});

// === POST update config.json ===
router.post("/config", express.json(), async (req, res) => {
    try {
        const config = req.body;
        await fs.promises.writeFile(
            CONFIG_PATH,
            JSON.stringify(config, null, 2),
            "utf8"
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
