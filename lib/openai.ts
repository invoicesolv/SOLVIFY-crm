import { OpenAI } from "openai";

export function validateApiKey(key: string): Promise<boolean> {
  return new Promise((resolve) => {
    // If key is empty
    if (!key || key.trim() === "") {
      resolve(false);
      return;
    }
    
    // Verify the key by making a test request
    const client = new OpenAI({
      apiKey: key,
      dangerouslyAllowBrowser: true,
    });
    
    client.models.list()
      .then(() => {
        resolve(true);
      })
      .catch((error) => {
        console.error("API key validation failed:", error);
        resolve(false);
      });
  });
}