function getRandomValue(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function addDelayError() {
    const ms = getRandomValue([100, 150, 200, 300, 600, 500, 1000, 1400, 2500]);
    const shouldThrowError = getRandomValue([1, 2, 3, 4, 5, 6, 7, 8]) === 8;
    
    if (shouldThrowError) {
        const randomError = getRandomValue([
            "DB Payment Failure",
            "DB Server is Down",
            "Access Denied",
            "Not Found Error",
        ]);
        return Promise.reject(new Error(randomError));
    }
    
    return new Promise((resolve) => setTimeout(() => resolve(ms), ms));
}

function simulatePlatformError() {
    const delay = getRandomValue([100, 300, 500, 800, 1000, 1500, 2000]);
    const shouldFail = getRandomValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) >= 7; // ~40% chance to throw error

    if (shouldFail) {
        const platformErrors = [
            "503 Service Unavailable - Server Overload",
            "502 Bad Gateway - Load Balancer Error",
            "504 Gateway Timeout - Slow API Response",
            "403 Forbidden - Maintenance Mode Enabled",
            "401 Unauthorized - Token Expired",
            "500 Internal Server Error - Crash in Backend",
            "DNS Lookup Failure - Domain Not Resolving",
            "Database Locked - Maintenance in Progress",
            "Read-Only Mode - Upgrade in Progress",
        ];
        return Promise.reject(new Error(getRandomValue(platformErrors)));
    }

    return new Promise((resolve) =>
        setTimeout(() => resolve(`✅ Platform running fine after ${delay}ms`), delay)
    );
}

export { addDelayError, simulatePlatformError };
