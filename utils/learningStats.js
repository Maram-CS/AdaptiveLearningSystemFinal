function startOfLocalDay(dateInput = new Date()) {
    const date = new Date(dateInput);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function getDayKey(dateInput) {
    const date = startOfLocalDay(dateInput);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calculateCurrentStreak(progressRecords = []) {
    if (!Array.isArray(progressRecords) || progressRecords.length === 0) {
        return 0;
    }

    // Collect all unique days with activity
    const activeDays = new Set();
    for (const record of progressRecords) {
        const timestamp = record?.lastUpdated || record?.updatedAt || record?.createdAt;
        if (timestamp) {
            try {
                const dayKey = getDayKey(new Date(timestamp));
                activeDays.add(dayKey);
            } catch (e) {
                console.error("Error processing timestamp:", timestamp, e);
            }
        }
    }

    if (activeDays.size === 0) {
        return 0;
    }

    // Get today and yesterday
    const today = startOfLocalDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayKey = getDayKey(today);
    const yesterdayKey = getDayKey(yesterday);

    // Check if there's activity today or yesterday
    let streak = 0;
    let cursor;

    if (activeDays.has(todayKey)) {
        // Activity today
        streak = 1;
        cursor = new Date(today);
        cursor.setDate(cursor.getDate() - 1);
    } else if (activeDays.has(yesterdayKey)) {
        // Activity yesterday but not today
        streak = 1;
        cursor = new Date(yesterday);
        cursor.setDate(cursor.getDate() - 1);
    } else {
        // No activity today or yesterday - streak is broken
        return 0;
    }

    // Count consecutive days backward
    while (true) {
        const cursorKey = getDayKey(cursor);
        if (!activeDays.has(cursorKey)) {
            break;
        }
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
}

function parseDurationToMinutes(durationText = "") {
    const value = String(durationText).trim().toLowerCase();
    if (!value) return 0;

    const number = parseFloat(value.replace(",", "."));
    if (Number.isNaN(number)) return 0;

    if (value.includes("hour") || value.includes("hr") || value.includes("h")) {
        return Math.round(number * 60);
    }

    return Math.round(number);
}

function formatMinutesAsHoursAndMinutes(totalMinutes = 0) {
    const safeMinutes = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    return { hours, minutes };
}

function calculateQuizAverage(levelProgressDocs = []) {
    const scores = [];

    for (const doc of levelProgressDocs) {
        if (doc?.placementCompleted) {
            scores.push(Number(doc.placementScore || 0));
        }

        const levelEntries = doc?.levels ? Object.values(doc.levels) : [];
        levelEntries.forEach(level => {
            if ((level?.quizAttempts || 0) > 0) {
                scores.push(Number(level.lastScore || 0));
            }
        });
    }

    if (scores.length === 0) {
        return 0;
    }

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function calculateCourseProgressPercent(course, progressRecords = []) {
    const totalLessons = course?.lessons?.length || 0;
    if (totalLessons === 0) {
        return 0;
    }

    const progressByLesson = new Map();
    progressRecords.forEach(record => {
        progressByLesson.set(String(record.lessonId), Number(record.progress || 0));
    });

    let totalProgress = 0;
    course.lessons.forEach(lesson => {
        totalProgress += progressByLesson.get(String(lesson._id)) || 0;
    });

    return Math.round(totalProgress / totalLessons);
}

function calculateTimeSpentMinutes(course, progressRecords = []) {
    const lessonById = new Map(
        (course?.lessons || []).map(lesson => [String(lesson._id), lesson])
    );

    return progressRecords.reduce((sum, record) => {
        const lesson = lessonById.get(String(record.lessonId));
        const lessonMinutes = parseDurationToMinutes(lesson?.duration || "");
        const progressRatio = Math.max(0, Math.min(100, Number(record.progress || 0))) / 100;
        return sum + (lessonMinutes * progressRatio);
    }, 0);
}

export {
    calculateCurrentStreak,
    calculateQuizAverage,
    calculateCourseProgressPercent,
    calculateTimeSpentMinutes,
    formatMinutesAsHoursAndMinutes,
    parseDurationToMinutes
};
