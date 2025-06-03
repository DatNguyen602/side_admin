const mongoose = require("mongoose");

const ReactionSchema = new mongoose.Schema({
  message: { type: mongoose.Schema.Types.ObjectId, ref: "Message", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { 
    type: String, 
    enum: ["like", "love", "laugh", "sad", "angry", "wow", "custom"], 
    required: true 
  },
  icon: {
    type: String,
    validate: {
      validator: function(v) {
        if (this.type === "custom") return !!v;
        return true;
      },
      message: "Icon phải có khi reaction type là 'custom'"
    }
  },
  addedAt: { type: Date, default: Date.now }
});

ReactionSchema.index({ message: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Reaction", ReactionSchema);
