import connection from "../config/connectDB.js";

const isMockDatabase = String(process.env.SKIP_DB || "").trim().toLowerCase() === "true";
let mockGamesEnabled = false;
let schemaPromise = null;

const ensureGameAccessSchema = async () => {
    if (isMockDatabase) return;

    if (!schemaPromise) {
        schemaPromise = (async () => {
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS game_access_settings (
                    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
                    games_enabled TINYINT(1) NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            await connection.execute(`
                INSERT IGNORE INTO game_access_settings (id, games_enabled)
                VALUES (1, 0)
            `);
        })().catch((error) => {
            schemaPromise = null;
            throw error;
        });
    }

    await schemaPromise;
};

const getGamesEnabled = async () => {
    if (isMockDatabase) return mockGamesEnabled;

    await ensureGameAccessSchema();
    const [rows] = await connection.execute(`
        SELECT games_enabled
        FROM game_access_settings
        WHERE id = 1
        LIMIT 1
    `);

    return rows.length > 0 && Number(rows[0].games_enabled) === 1;
};

const setGamesEnabled = async (enabled) => {
    const normalizedState = Boolean(enabled);

    if (isMockDatabase) {
        mockGamesEnabled = normalizedState;
        return mockGamesEnabled;
    }

    await ensureGameAccessSchema();
    await connection.execute(`
        INSERT INTO game_access_settings (id, games_enabled)
        VALUES (1, ?)
        ON DUPLICATE KEY UPDATE games_enabled = VALUES(games_enabled)
    `, [normalizedState ? 1 : 0]);

    return normalizedState;
};

const status = async (req, res) => {
    try {
        const enabled = await getGamesEnabled();
        return res.status(200).json({ status: true, enabled });
    } catch (error) {
        console.error("Unable to read game access status:", error);
        return res.status(500).json({
            status: false,
            enabled: false,
            message: "Unable to read game status.",
        });
    }
};

const updateStatus = async (req, res) => {
    const requestedState = req.body?.enabled;

    if (requestedState !== true && requestedState !== false) {
        return res.status(400).json({
            status: false,
            message: "A valid games enabled state is required.",
        });
    }

    try {
        const enabled = await setGamesEnabled(requestedState);
        return res.status(200).json({
            status: true,
            enabled,
            message: enabled ? "All games are now live." : "All games are now paused.",
        });
    } catch (error) {
        console.error("Unable to update game access status:", error);
        return res.status(500).json({
            status: false,
            message: "Unable to update game status.",
        });
    }
};

const requireEnabledPage = async (req, res, next) => {
    try {
        if (await getGamesEnabled()) return next();
    } catch (error) {
        console.error("Unable to verify game page access:", error);
    }

    return res.redirect("/home");
};

const requireEnabledBet = async (req, res, next) => {
    try {
        if (await getGamesEnabled()) return next();
    } catch (error) {
        console.error("Unable to verify game bet access:", error);
    }

    return res.status(503).json({
        status: false,
        message: "Games are currently paused.",
    });
};

export { getGamesEnabled, setGamesEnabled };

export default {
    status,
    updateStatus,
    requireEnabledPage,
    requireEnabledBet,
};
