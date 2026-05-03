import express from "express";
import cors from "cors";
import jsonfile from "jsonfile";
import moment from "moment";
import simpleGit from "simple-git";

const app = express();
app.use(cors());
app.use(express.json());

const path = "./data.json";

const makeCommit = (callback) => {
    const date = moment().format();

    const data = {
        date: date,
    };

    console.log(`Making commit for: ${date}`);

    jsonfile.writeFile(path, data, () => {
        simpleGit().add([path]).commit(date, { "--date": date }, () => {
            console.log("Finished making commit. Pushing to GitHub...");
            simpleGit().push(() => {
                if (callback) callback();
            });
        });
    });
};

app.post("/api/commit", (req, res) => {
    console.log("Received commit request from frontend...");
    try {
        makeCommit(() => {
            res.status(200).json({ success: true, message: "Commit made and pushed successfully!" });
        });
    } catch (error) {
        console.error("Error making commit:", error);
        res.status(500).json({ success: false, message: "Failed to make commit." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Git Committer API running on http://localhost:${PORT}`);
});
