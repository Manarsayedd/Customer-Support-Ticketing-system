const express = require('express');

const app = express();
app.use(express.json());

app.post('/notify', (req, res) => {
    const { message, ticketId } = req.body;
    
    // Simulate sending email/SMS
    console.log(`[NOTIFICATION] Ticket ID: ${ticketId} | Message: ${message}`);
    
    res.status(200).json({ status: 'Notification sent' });
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Notification Service running on port ${PORT}`));
