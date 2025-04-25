import { kafka } from './client.js';  // Assuming `kafka` is correctly imported from somewhere

const producer = kafka.producer();
console.log("Connecting to producer...");

await producer.connect();
console.log("Connected to producer");

// Use named export
export { producer };
