import express from 'express';
import cors from 'cors';
import { Octokit } from 'octokit';
import moment from "moment";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// In-memory counter for Vercel (resets on sleep)
let dailyCount = 0;
let currentDate = moment().format('YYYY-MM-DD');

function getStats() {
    const today = moment().format('YYYY-MM-DD');
    if (currentDate !== today) {
        currentDate = today;
        dailyCount = 0;
    }
    return { date: currentDate, count: dailyCount };
}

app.get('/api/stats', (req, res) => {
    res.json(getStats());
});

app.post('/api/commit', async (req, res) => {
    const { repoUrl } = req.body;
    
    if (!repoUrl) {
        return res.status(400).json({ error: 'Repository URL is required.' });
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        return res.status(401).json({ error: 'GITHUB_TOKEN environment variable is missing.' });
    }

    try {
        // Parse repo url (e.g. https://github.com/username/repo.git)
        // Remove trailing slashes and .git
        let cleanUrl = repoUrl.trim().replace(/\/+$/, '').replace(/\.git$/, '');
        const parts = cleanUrl.split('/');
        const repo = parts.pop();
        const owner = parts.pop();

        if (!owner || !repo) {
            return res.status(400).json({ error: 'Invalid GitHub repository URL.' });
        }

        const octokit = new Octokit({ auth: token });
        
        // 1. Get default branch
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
        const defaultBranch = repoData.default_branch;

        // 2. Get the latest commit SHA
        const { data: refData } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${defaultBranch}`
        });
        const latestCommitSha = refData.object.sha;

        // 3. Get the commit data to find the tree SHA
        const { data: commitData } = await octokit.rest.git.getCommit({
            owner,
            repo,
            commit_sha: latestCommitSha
        });
        const baseTreeSha = commitData.tree.sha;

        // 4. Create a new blob with the content
        const date = moment().format();
        const content = JSON.stringify({ date: date }, null, 2);
        
        const { data: blobData } = await octokit.rest.git.createBlob({
            owner,
            repo,
            content: content,
            encoding: 'utf-8'
        });
        const blobSha = blobData.sha;

        // 5. Create a new tree containing the new blob
        const { data: treeData } = await octokit.rest.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: [{
                path: 'data.json',
                mode: '100644',
                type: 'blob',
                sha: blobSha
            }]
        });
        const newTreeSha = treeData.sha;

        // 6. Create a new commit
        const { data: newCommitData } = await octokit.rest.git.createCommit({
            owner,
            repo,
            message: `Contribution update: ${date}`,
            tree: newTreeSha,
            parents: [latestCommitSha]
        });
        const newCommitSha = newCommitData.sha;

        // 7. Update the branch reference
        await octokit.rest.git.updateRef({
            owner,
            repo,
            ref: `heads/${defaultBranch}`,
            sha: newCommitSha
        });

        // Update stats
        const stats = getStats();
        dailyCount += 1;
        stats.count = dailyCount;

        res.status(200).json({ 
            message: 'Contribution pushed successfully via API!',
            count: stats.count
        });
    } catch (error) {
        console.error("Error during Octokit commit process:", error);
        res.status(500).json({ error: error.message || 'Failed to push contribution. Ensure GITHUB_TOKEN has correct permissions.' });
    }
});

// Run local server if not on Vercel
if (!process.env.VERCEL) {
    const port = 3000;
    app.listen(port, () => {
        console.log(`Local dev server running on port ${port}`);
    });
}

// Export for Vercel serverless
export default app;
