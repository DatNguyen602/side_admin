const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const natural = require("natural");
const cosine = require("cosine-similarity");
const fetch = require("node-fetch");
require("dotenv").config();

const Answer = require("../../models/Answer");

const GEMINI_KEY = process.env.GEMINI_KEY;
const ENABLE_ANSWER_CACHE = process.env.ENABLE_ANSWER_CACHE === "true";

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();

// Tiền xử lý
function preprocess(text) {
    return tokenizer.tokenize(text.toLowerCase().replace(/[^\w\s]/gi, ""));
}

// Load dữ liệu gốc
const dataPath = path.join(__dirname, "../../public/data.json");
let data = [];
let questions = [];
let allTerms = [];

try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    questions = data.map((d) => d.question);
    questions.forEach((q) => tfidf.addDocument(q));

    const termsSet = new Set();
    for (let i = 0; i < tfidf.documents.length; i++) {
        tfidf.listTerms(i).forEach((t) => termsSet.add(t.term));
    }
    allTerms = [...termsSet];

    console.log(`✅ Loaded ${questions.length} questions into TF-IDF.`);
} catch (err) {
    console.error("❌ Failed to load or process data.json:", err);
}

// Tạo vector
function buildVectorFromText(rawText) {
    const tempTfidf = new TfIdf();
    tempTfidf.addDocument(rawText);
    const terms = tempTfidf.listTerms(0);

    return allTerms.map((term) => {
        const found = terms.find((t) => t.term === term);
        return found ? found.tfidf : 0;
    });
}

// API chính
router.post("/chat", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const processedMessage = preprocess(message).join(" ");
    const userVector = buildVectorFromText(processedMessage);

    // So khớp với câu hỏi đã lưu trong MongoDB
    const allSaved = await Answer.find({});
    let matchedAnswer = null;
    let highestScore = -1;

    for (let item of allSaved) {
        const vector = item.vector.length
            ? item.vector
            : buildVectorFromText(item.question);
        const score = cosine(userVector, vector);
        if (score > highestScore) {
            highestScore = score;
            matchedAnswer = item;
        }
    }

    if (highestScore >= 0.9 && matchedAnswer) {
        return res.json({
            answer: matchedAnswer.answer,
            confidence: highestScore.toFixed(3),
            source: "cached",
            cached: ENABLE_ANSWER_CACHE,
        });
    }

    // Nếu chưa có trong MongoDB, so với data gốc (data.json)
    let maxScore = -1;
    let bestMatchIndex = -1;

    questions.forEach((q, i) => {
        const processedQ = preprocess(q).join(" ");
        const questionVector = buildVectorFromText(processedQ);
        const score = cosine(userVector, questionVector);

        if (score > maxScore) {
            maxScore = score;
            bestMatchIndex = i;
        }
    });

    const THRESHOLD = 0.1;
    const bestAnswer =
        maxScore >= THRESHOLD
            ? data[bestMatchIndex].answer
            : "Tôi không hiểu câu hỏi của bạn.";

    // Gọi Gemini API
    const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `Please rewrite the answer based on the user question: "${message}" and the suggested answer: "${bestAnswer}". 
Make it sound more natural, friendly, and conversational – as if you're a helpful friend explaining it. Do not translate – preserve the original language of the question.`,
                            },
                        ],
                    },
                ],
            }),
        }
    );

    const dataRes = await geminiRes.json();
    const geminiAnswer =
        dataRes?.candidates?.[0]?.content?.parts?.[0]?.text || bestAnswer;

    // Lưu nếu cho phép
    if (ENABLE_ANSWER_CACHE) {
        try {
            await Answer.create({
                question: message,
                answer: geminiAnswer,
                vector: userVector,
            });
        } catch (err) {
            console.error("⚠️ Failed to cache answer:", err.message);
        }
    }

    res.json({
        answer: geminiAnswer,
        confidence: maxScore.toFixed(3),
        source: "gemini",
        cached: ENABLE_ANSWER_CACHE,
    });
});

module.exports = router;
