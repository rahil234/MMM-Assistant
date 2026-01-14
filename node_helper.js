const NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
	start() {
	},

	async socketNotificationReceived(notification, payload) {
		if (notification === "GENERATE_ANSWER") {
			const { prompt, context = "" } = payload

			console.log("[MMM-Assistant] Generating answer for prompt:", prompt);

			const answer = await this.generateAnswer(prompt, context)

			console.log("[MMM-Assistant] Generated answer:", answer);

			this.sendSocketNotification("ASSISTANT_RESPONSE", {
				text: answer
			})
		}
	},

	async generateAnswer(prompt, context) {
		try {
			const response = await fetch("http://localhost:11434/api/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: "llama3.1:8b",
					prompt: `You are a helpful voice assistant for a MagicMirror.
							Answer concisely.
							User: ${prompt}`,
					stream: false
				})
			})

			const data = await response.json()
			return data.response?.trim() || "I couldn't generate a response."

		} catch (err) {
			console.error("[MMM-Assistant] LLM error:", err)
			return "Sorry, something went wrong."
		}
	}
})
