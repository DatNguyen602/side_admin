const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const natural = require("natural");
const cosine = require("cosine-similarity");
require("dotenv").config();

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();

// Bước tiền xử lý nâng cao
function preprocess(text) {
    return tokenizer.tokenize(text.toLowerCase().replace(/[^\w\s]/gi, ""));
}

// Load dữ liệu một lần duy nhất
const dataPath = path.join(__dirname, "../../public/data.json");
let data = [];
let questions = [];
let allTerms = [];

try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    questions = data.map((d) => d.question);

    if (questions.length === 0) throw new Error("No questions in data");

    questions.forEach((q) => tfidf.addDocument(q));

    // Sau khi addDocument xong mới lấy terms
    if (tfidf.documents.length > 0) {
        const termsSet = new Set();
        for (let i = 0; i < tfidf.documents.length; i++) {
            tfidf.listTerms(i).forEach((t) => termsSet.add(t.term));
        }
        allTerms = [...termsSet];
    }

    console.log(`✅ Loaded ${questions.length} questions into TF-IDF.`);
} catch (err) {
    console.error("❌ Failed to load or process data.json:", err);
}

// Tạo vector tf-idf thủ công từ chuỗi raw
function buildVectorFromText(rawText) {
    const tempTfidf = new TfIdf();
    tempTfidf.addDocument(rawText);

    const terms = tempTfidf.listTerms(0);
    const vector = [];

    for (let term of allTerms) {
        const found = terms.find((t) => t.term === term);
        vector.push(found ? found.tfidf : 0);
    }

    return vector;
}

// API trả lời câu hỏi
router.post("/chat", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const processedMessage = preprocess(message).join(" ");
    const userVector = buildVectorFromText(processedMessage);

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

    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
            process.env.GEMINI_KEY,
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
                                Make it sound more natural, friendly, and conversational – as if you're a helpful friend explaining it. 
                                Do not translate – preserve the original language of the question.`,
                            },
                        ],
                    },
                ],
            }),
        }
    );
    const dataRes = await response.json();
    console.dir(dataRes, { depth: null, colors: true, showHidden: true });
    // console.log(message + " answer: " + bestAnswer);
    // console.log(
    //     "gemini: " + dataRes.candidates?.[0]?.content?.parts?.[0]?.text
    // );

    res.json({
        answer: dataRes.candidates?.[0]?.content?.parts?.[0]?.text,
        confidence: maxScore.toFixed(3),
    });
});

module.exports = router;
