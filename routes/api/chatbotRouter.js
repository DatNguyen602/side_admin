const express = require("express");
const router = express.Router();
const fs = require("fs");
const natural = require("natural");
const cosine = require("cosine-similarity");
const path = require("path");

// Tách từ và vector hóa
const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../../public/data.json"), "utf8"));
const questions = data.map((d) => d.question);

// Thêm dữ liệu vào tf-idf
questions.forEach((q) => tfidf.addDocument(q));

router.post("/chat", (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Vector hóa câu hỏi người dùng
    const userTokens = tokenizer.tokenize(message.toLowerCase());
    const userVector = [];
    tfidf.tfidfs(message, (i, measure) => userVector.push(measure));

    // Tính tương đồng cosine
    let maxScore = -1;
    let bestMatchIndex = -1;

    for (let i = 0; i < questions.length; i++) {
        const questionVector = [];
        tfidf.tfidfs(questions[i], (j, measure) =>
            questionVector.push(measure)
        );
        const score = cosine(userVector, questionVector);
        if (score > maxScore) {
            maxScore = score;
            bestMatchIndex = i;
        }
    }

    const answer =
        data[bestMatchIndex]?.answer || "Tôi không hiểu câu hỏi của bạn.";
    res.json({ answer, confidence: maxScore.toFixed(3) });
});

module.exports = router;
