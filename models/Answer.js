const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    defaultAnswer: {
        type: String,
        required: false,
        trim: true,
        default: "",
    },
    geminiAnswer: {
        type: String,
        required: false,
        trim: true,
        default: "",
    },
    vector: {
        type: [Number],
        default: [],
    },
    source: {
        type: String,
        enum: ["seed", "manual"],
        default: "manual",
    },
    tags: {
        type: [String],
        default: [],
    },
    approved: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
    },
});

AnswerSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model("Answer", AnswerSchema);
