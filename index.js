import express from 'express';
import cors from 'cors';
import jsonfile from "jsonfile";
import moment from "moment";
import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const STATS_FILE = path.resolve(process.cwd(), 'stats.json');

async function getStats() {
    const today = moment().format('YYYY-MM-DD');
    try {
        const stats = await jsonfile.readFile(STATS_FILE);
        if (stats.date === today) {
            return stats;
        } else {
            return { date: today, count: 0 };
        }
    } catch (error) {
        return { date: today, count: 0 };
    }
}

async function incrementStats() {
    const stats = await getStats();
    stats.count += 1;
    await jsonfile.writeFile(STATS_FILE, stats);
    return stats;
}

app.get('/api/stats', async (req, res) => {
    const stats = await getStats();
    res.json(stats);
});

app.post('/api/commit', async (req, res) => {
    const { repoUrl } = req.body;
    
    if (!repoUrl) {
        return res.status(400).json({ error: 'Repository URL is required.' });
    }

    const cleanUrl = repoUrl.trim().replace(/\/+$/, '').replace(/\.git$/, '');
    const parts = cleanUrl.split('/');
    const repoName = parts.pop() || `repo-${Date.now()}`;
    
    const cloneDir = path.resolve(process.cwd(), 'repos', repoName);

    try {
        let repoExists = false;
        try {
            await fs.access(cloneDir);
            repoExists = true;
        } catch (e) {
            repoExists = false;
        }

        let cloneUrl = repoUrl;
        const token = process.env.GITHUB_TOKEN;
        if (token && repoUrl.startsWith('https://github.com/')) {
            cloneUrl = repoUrl.replace('https://github.com/', `https://${token}@github.com/`);
        }

        if (!repoExists) {
            console.log(`Cloning ${repoUrl} into ${cloneDir}...`);
            await simpleGit().clone(cloneUrl, cloneDir);
            console.log(`Successfully cloned.`);
        } else {
            console.log(`Repository already exists at ${cloneDir}. Pulling latest changes...`);
            const git = simpleGit(cloneDir);
            await git.remote(['set-url', 'origin', cloneUrl]);
            await git.pull();
        }

        const clonedGit = simpleGit(cloneDir);
        
        const dataPath = path.join(cloneDir, 'data.json');
        const date = moment().format();
        const data = { date: date };

        await jsonfile.writeFile(dataPath, data);
        
        console.log(`Committing and pushing...`);
        await clonedGit.add(['data.json']).commit(date, { '--date': date }).push();
        
        const newStats = await incrementStats();

        console.log(`Commit successfully pushed to ${repoUrl}! Total today: ${newStats.count}`);
        res.status(200).json({ 
            message: 'Contribution pushed successfully!',
            count: newStats.count
        });
    } catch (error) {
        console.error("Error during commit process:", error);
        res.status(500).json({ error: error.message || 'Failed to push contribution.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Open this URL in your browser to use the frontend.`);
});
