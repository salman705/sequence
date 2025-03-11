require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 7000,
    MONGO_URL: process.env.MONGO_URL,
    corsOptions: {
        origin: '*', 
        methods: ["GET", "POST", "OPTIONS"]
    }
};
