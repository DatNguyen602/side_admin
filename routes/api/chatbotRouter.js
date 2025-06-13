const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const natural = require("natural");
const cosine = require("cosine-similarity");
const fetch = require("node-fetch");
const Answer = require("../../models/Answer");
require("dotenv").config();

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

let allTerms = [];

// Tiền xử lý văn bản
function preprocess(text) {
    return tokenizer.tokenize(text.toLowerCase().replace(/[^\w\s]/gi, ""));
}

// Tạo vector tf-idf từ văn bản
function buildVectorFromText(rawText) {
    const tempTfidf = new TfIdf();
    tempTfidf.addDocument(rawText);
    const terms = tempTfidf.listTerms(0);
    return allTerms.map((term) => {
        const found = terms.find((t) => t.term === term);
        return found ? found.tfidf : 0;
    });
}

// Tạo danh sách từ khóa (terms) từ data.json
function buildAllTermsFromData() {
    const dataPath = path.join(__dirname, "../../public/data.json");
    const rawData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const tfidf = new TfIdf();

    rawData.forEach((item) => tfidf.addDocument(item.question));
    const termsSet = new Set();
    for (let i = 0; i < tfidf.documents.length; i++) {
        tfidf.listTerms(i).forEach((t) => termsSet.add(t.term));
    }

    allTerms = [...termsSet];
}

// Khởi tạo DB từ file data.json nếu chưa có
async function initDatabaseFromJSON() {
    const dataPath = path.join(__dirname, "../../public/data.json");
    const jsonData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    for (const item of jsonData) {
        const exists = await Answer.findOne({ question: item.question });
        if (!exists) {
            const vector = buildVectorFromText(
                preprocess(item.question).join(" ")
            );
            await Answer.create({
                question: item.question,
                defaultAnswer: item.answer,
                vector,
                source: "seed",
            });
        }
    }

    console.log(`✅ Synced data.json into MongoDB.`);
}

buildAllTermsFromData();
initDatabaseFromJSON();

const GEMINI_KEY = process.env.GEMINI_KEY;

const bannedBrands = [
    "honda",
    "yamaha",
    "suzuki",
    "sym",
    "kymco",
    "vinfast",
    "vespa lx",
    "lx",
    "vision",
    "lead",
    "ab",
    "airblade",
    "wave",
    "future",
    "vario",
    "click",
    "dream",
    "winner",
    "exciter",
    "xe điện",
    "xe vinfast",
    "peugeot",
    "sirius",
];

function containsBannedBrand(message) {
    const tokens = preprocess(message); // dùng tokenizer có sẵn
    return bannedBrands.some((brand) =>
        tokens.some((token) => token.includes(brand))
    );
}

router.post("/chat", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    if (containsBannedBrand(message)) {
        return res.json({
            answer: "Xin lỗi, tôi chỉ có thể trả lời các câu hỏi liên quan đến Piaggio.",
            confidence: "1.000",
            source: "blocked-brand",
        });
    }

    const processedMessage = preprocess(message).join(" ");
    const userVector = buildVectorFromText(processedMessage);

    const allAnswers = await Answer.find({});
    let bestMatch = null;
    let highestScore = -1;

    for (let item of allAnswers) {
        const score = cosine(userVector, item.vector);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    }

    const THRESHOLD = 0.75;

    // Nếu câu hỏi gần giống câu đã có
    if (highestScore >= THRESHOLD && bestMatch) {
        if (bestMatch.geminiAnswer) {
            return res.json({
                answer: bestMatch.geminiAnswer,
                confidence: highestScore.toFixed(3),
                source: "cached-gemini",
            });
        }

        // Chưa có geminiAnswer → tạo mới từ Gemini
        const prompt = `
        User's Question:
        "${message}"

        Suggested Answer:
        "${bestMatch.defaultAnswer || "No answer available."}"

        🎯 Task:
        Rewrite the suggested answer so that it reflects both expertise and warmth — like a knowledgeable expert explaining to someone in a clear, friendly, and respectful way.

        🔍 If the current answer lacks depth, is outdated, or could be made more helpful, look up relevant and trustworthy information online to improve it.

        📌 Guidelines:
        - Do NOT translate the language — use the same language as the user's question.
        - Keep the tone professional yet approachable — confident, warm, and easy to follow.
        - If helpful, briefly include additional context, caveats, or real-world tips based on your web search.
        - If no relevant information is found online, just polish and clarify the existing answer.
        - Return only one improved answer — no variations, no bullet points, no notes.

        ✅ Output:
        [A single expert-yet-friendly answer, improved and optionally enhanced with researched information.]
        `;

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        const dataRes = await geminiRes.json();
        const geminiText = dataRes?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (geminiText) {
            bestMatch.geminiAnswer = geminiText;
            await bestMatch.save();
        }

        return res.json({
            answer: geminiText || bestMatch.defaultAnswer,
            confidence: highestScore.toFixed(3),
            source: "generated-from-default",
        });
    }

    // Không tìm thấy câu giống → tạo mới hoàn toàn từ Gemini
    const fallbackPrompt = `Please answer this question as naturally and helpfully as possible: "${message}".`;

    const fallbackRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fallbackPrompt }] }],
            }),
        }
    );

    const fallbackData = await fallbackRes.json();
    const generatedAnswer =
        fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Tôi chưa có câu trả lời phù hợp.";

    await Answer.create({
        question: message,
        geminiAnswer: generatedAnswer,
        vector: userVector,
        source: "manual",
    });

    return res.json({
        answer: generatedAnswer,
        confidence: "0.000",
        source: "generated-new",
    });
});

module.exports = router;
