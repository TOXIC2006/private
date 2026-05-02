import jsonfile from "jsonfile";
import moment from "moment";
import simpleGit from "simple-git";

const path = "./data.json";

const makeCommits = (n) => {
    if (n === 0) {
        console.log("Finished making commits. Pushing to GitHub...");
        return simpleGit().push();
    }
    
    // Subtract `n` days from today to get sequential days
    const date = moment().subtract(n, "d").format();

    const data = {
        date: date,
    };
    
    console.log(`Making commit for: ${date}`);
    
    jsonfile.writeFile(path, data, () => {
        simpleGit().add([path]).commit(date, { "--date": date }, makeCommits.bind(this, --n));
    });
};

// Make commits for the past 365 days
console.log("Starting contribution process...");
makeCommits(365);
