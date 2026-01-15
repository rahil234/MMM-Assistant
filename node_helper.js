const NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
	start() {
    console.log("Node helper started.");
    this.config = {};
	},

	async socketNotificationReceived(notification, payload) {
    if (notification === "INIT_CONFIG") {
      this.config = payload;
      console.log("[MMM-Assistant] Config loaded:", this.config);
      return;
    }


    if (notification === "GENERATE_ANSWER") {
			const { prompt, context = "" } = payload

			console.log("[MMM-Assistant] Generating answer for prompt:", prompt);

			// const answer = await this.generateAnswer(prompt, context)
      await this.streamAnswer(prompt, context)

			// console.log("[MMM-Assistant] Generated answer:", answer);

			// this.sendSocketNotification("ASSISTANT_RESPONSE", {
			// 	text: answer
			// })
		}
	},

	async generateAnswer(prompt, context) {
		try {
			const response = await fetch("http://localhost:11434/api/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: this.config.model,
					prompt: `${this.config.systemPrompt}
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
	},

  async streamAnswer(prompt, context) {
    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          prompt: `${this.config.systemPrompt}
User: ${prompt}`,
          stream: true
        })
      })

      if (!response.body) {
        throw new Error("No response body")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")

      let buffer = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() // keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue

          const data = JSON.parse(line)

          if (data.response) {
            this.sendSocketNotification("ASSISTANT_STREAM", {
              text: data.response
            })
          }

          if (data.done) {
            this.sendSocketNotification("ASSISTANT_STREAM_END")
          }
        }
      }
    } catch (err) {
      console.error("[MMM-Assistant] Streaming error:", err)
      this.sendSocketNotification("ASSISTANT_ERROR", {
        text: "Sorry, something went wrong."
      })
    }
  }
})
