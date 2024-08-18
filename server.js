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
        const { stdout: title } = await exec(url, {
            getTitle: true,  // 獲取標題
        });
        const videoId = url.split('v=')[1].split('&')[0];
        const embedUrl = url;

        console.log('Video Title:', title.trim()); // 確認標題是否正確提取

        console.log('Starting download...');
        // 下載音訊
        await exec(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: output,
        });
        console.log('Download completed.');

        
        // 將下載的音訊檔案發送到OpenAI進行轉錄
        const formData = new FormData();
        formData.append('file', fs.createReadStream(output));
        formData.append('model', 'whisper-1');

        console.log('Starting transcription...');
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                ...formData.getHeaders(),
            },
        });
        console.log('Transcription completed.');

        let transcription = response.data.text;
        transcription = wrapText(transcription);  // 例如，每行最多40個字符

        console.log(transcription);
        
        
        res.json({
            title: title.trim(),  // 返回影片標題
            transcription,
            audioSrc: embedUrl
        });

        // fs.unlinkSync(output);
    } catch (error) {
        console.error('Error processing download:', error);
        res.status(500).json({ error: 'Failed to download and transcribe video' });
    }
});

function wrapText(text) {
    // 根據全形或半形標點符號來分割文本
    const sentences = text.split(/(?<=[。？?.!！])/);
    
    // 將分割後的句子以換行符號連接起來
    return sentences.join('\n');
}




app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
