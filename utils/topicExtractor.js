/**
 * topicExtractor.js
 * 
 * Extracts the most likely programming/learning topic from a quiz question's text.
 * Works entirely from question wording — no schema changes needed.
 * 
 * Returns a short topic label like "Loops", "Functions", "Arrays", etc.
 */

// Keyword map: each topic has a list of keywords/phrases to match
const TOPIC_MAP = [
    { topic: "Loops",           keywords: ["loop", "for loop", "while loop", "do while", "iteration", "iterate", "forEach", "repeat"] },
    { topic: "Functions",       keywords: ["function", "arrow function", "return", "callback", "invoke", "call", "parameter", "argument"] },
    { topic: "Arrays",          keywords: ["array", "list", "index", "element", "push", "pop", "slice", "splice", "map(", "filter(", "reduce("] },
    { topic: "Objects",         keywords: ["object", "property", "key", "value", "dot notation", "bracket notation", "method", "{}"] },
    { topic: "Variables",       keywords: ["var", "let", "const", "variable", "declare", "assignment", "scope", "hoisting"] },
    { topic: "Conditionals",    keywords: ["if", "else", "switch", "condition", "ternary", "truthy", "falsy", "boolean"] },
    { topic: "Classes & OOP",   keywords: ["class", "constructor", "extends", "inherit", "prototype", "instance", "super", "encapsulation", "polymorphism"] },
    { topic: "Async & Promises",keywords: ["async", "await", "promise", "then", "catch", "setTimeout", "callback hell", "fetch"] },
    { topic: "DOM",             keywords: ["dom", "document", "element", "event", "listener", "querySelector", "getElementById", "html"] },
    { topic: "Error Handling",  keywords: ["try", "catch", "finally", "throw", "error", "exception"] },
    { topic: "Data Types",      keywords: ["string", "number", "boolean", "null", "undefined", "typeof", "data type", "NaN"] },
    { topic: "Modules",         keywords: ["import", "export", "module", "require", "commonjs", "esm"] },

    // Python
    { topic: "Python Basics",   keywords: ["python", "print(", "input(", "indentation", "def ", "elif"] },
    { topic: "Pandas",          keywords: ["pandas", "dataframe", "series", "iloc", "loc", "groupby", "read_csv"] },
    { topic: "NumPy",           keywords: ["numpy", "ndarray", "np.", "axis", "reshape", "broadcasting"] },
    { topic: "Django",          keywords: ["django", "model", "view", "template", "orm", "migrate", "admin", "urls.py"] },

    // Databases
    { topic: "SQL",             keywords: ["select", "from", "where", "join", "group by", "order by", "insert", "update", "delete", "sql", "query"] },
    { topic: "MongoDB",         keywords: ["mongodb", "collection", "document", "nosql", "insertone", "find(", "aggregate", "mongoose"] },

    // Frontend
    { topic: "CSS",             keywords: ["css", "style", "flex", "grid", "margin", "padding", "selector", "class", "id", "display"] },
    { topic: "React",           keywords: ["react", "component", "props", "state", "hook", "usestate", "useeffect", "jsx", "render"] },

    // Backend & APIs
    { topic: "Node.js",         keywords: ["node", "express", "middleware", "req", "res", "server", "api", "routing"] },
    { topic: "REST APIs",       keywords: ["rest", "api", "endpoint", "get", "post", "put", "delete", "http", "status code"] },

    // Tools
    { topic: "Git",             keywords: ["git", "commit", "branch", "merge", "pull", "push", "repository", "clone"] },
    { topic: "Docker",          keywords: ["docker", "container", "image", "dockerfile", "compose", "volume"] },

    // Computer Science
    { topic: "Algorithms",      keywords: ["sort", "search", "binary search", "bubble sort", "complexity", "big o", "recursion", "stack", "queue"] },
    { topic: "Data Structures", keywords: ["linked list", "tree", "graph", "hashmap", "heap", "queue", "stack"] },

    // Extras (very useful)
    { topic: "Authentication",  keywords: ["auth", "jwt", "login", "signup", "token", "oauth", "session"] },
    { topic: "Testing",         keywords: ["test", "jest", "unit test", "integration test", "assert", "mock"] },
];

/**
 * Extract a topic label from a question's text.
 * @param {string} questionText
 * @returns {string} e.g. "Loops", "Functions", "General"
 */
export function extractTopic(questionText) {
    if (!questionText || typeof questionText !== "string") return "General";

    const lower = questionText.toLowerCase();

    // Score each topic by how many keywords match
    let bestTopic = "General";
    let bestScore = 0;

    for (const { topic, keywords } of TOPIC_MAP) {
        let score = 0;
        for (const kw of keywords) {
            if (lower.includes(kw.toLowerCase())) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestTopic = topic;
        }
    }

    return bestTopic;
}

/**
 * Given a list of QuizMistake documents, group them by topic
 * and return ranked recommendations.
 * 
 * @param {Array} mistakes  — QuizMistake documents
 * @param {number} limit    — max recommendations to return
 * @returns {Array} sorted recommendations
 */
export function buildRecommendations(mistakes, limit = 3) {
    // Count mistakes per topic
    const topicCounts = {};
    const topicQuestions = {}; // keep sample question per topic

    for (const m of mistakes) {
        const t = m.topic || "General";
        topicCounts[t] = (topicCounts[t] || 0) + 1;
        if (!topicQuestions[t]) topicQuestions[t] = m.questionText;
    }

    // Sort topics by mistake count descending
    const sorted = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

    return sorted.map(([topic, count]) => ({
        topic,
        count,
        sampleQuestion: topicQuestions[topic],
        icon: getTopicIcon(topic),
        message: buildMessage(topic, count)
    }));
}

function buildMessage(topic, count) {
    if (count === 1) return `You missed a question on ${topic}. Review this concept.`;
    if (count <= 3) return `You got ${count} questions wrong on ${topic}. Focus on this area.`;
    return `You struggled with ${topic} (${count} mistakes). This needs serious review!`;
}

function getTopicIcon(topic) {
    const icons = {
    "Loops":             "fas fa-sync-alt",
    "Functions":         "fas fa-code",
    "Arrays":            "fas fa-list",
    "Objects":           "fas fa-cubes",
    "Variables":         "fas fa-box",
    "Conditionals":      "fas fa-code-branch",
    "Classes & OOP":     "fas fa-sitemap",
    "Async & Promises":  "fas fa-hourglass-half",
    "DOM":               "fas fa-globe",
    "Error Handling":    "fas fa-exclamation-triangle",
    "Data Types":        "fas fa-database",
    "Modules":           "fas fa-puzzle-piece",

    "Python Basics":     "fab fa-python",
    "Pandas":            "fas fa-table",
    "NumPy":             "fas fa-calculator",
    "Django":            "fas fa-leaf",

    "SQL":               "fas fa-database",
    "MongoDB":           "fas fa-server",

    "CSS":               "fab fa-css3-alt",
    "React":             "fab fa-react",

    "Node.js":           "fab fa-node-js",
    "REST APIs":         "fas fa-plug",

    "Git":               "fab fa-git-alt",
    "Docker":            "fab fa-docker",

    "Algorithms":        "fas fa-sort-amount-up",
    "Data Structures":   "fas fa-project-diagram",

    "Authentication":    "fas fa-user-shield",
    "Testing":           "fas fa-vial",

    "General":           "fas fa-graduation-cap"
};
    return icons[topic] || "fas fa-graduation-cap";
}
