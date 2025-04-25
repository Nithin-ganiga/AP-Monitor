import { kafka } from './client.js';

async function init() {
    const admin = kafka.admin()
    console.log("Connecting to Kafka...")
    await admin.connect()
    console.log("Connected to Kafka")
    
    console.log("creating topic...")
    await admin.createTopics({
        topics: [
            { topic: 'error-logs', numPartitions: 2, replicationFactor: 1 },
            { topic: 'info', numPartitions: 2, replicationFactor: 1 },
            { topic: 'alerts', numPartitions: 2, replicationFactor: 1 }
           
        ]
    })
    console.log("Topics created")

    await admin.disconnect()
}
init();