const express = require('express');
const cors = require('cors');
const { exec } = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

app.post('/download', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }

    console.log(url);

    const output = path.resolve(__dirname, `downloads/${Date.now()}.mp3`);

    try {
        // 提取影片信息，包括標題
        const videoInfo = await exec(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
        });

        const title = videoInfo.title;  // 獲取影片標題

        // 下載音訊
        await exec(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: output,
        });

        // 將下載的音訊檔案發送到OpenAI進行轉錄
        const formData = new FormData();
        formData.append('file', fs.createReadStream(output));
        formData.append('model', 'whisper-1');

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                ...formData.getHeaders(),
            },
        });

        const transcription = response.data.text;

        res.json({
            title,  // 返回影片標題
            transcription,
            audio: {
                filename: path.basename(output),
                url: `http://localhost:${PORT}/downloads/${path.basename(output)}`,
            },
        });

        fs.unlinkSync(output);
    } catch (error) {
        console.error('Error processing download:', error);
        res.status(500).json({ error: 'Failed to download and transcribe video' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
