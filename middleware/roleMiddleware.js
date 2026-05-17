const roleRequest = (req, res, next) => {
    if(req.role !== "teacher"){
        return res.status(403).json({ message: "Forbidden: Access denied" });
    }
    next();
};

export { roleRequest };