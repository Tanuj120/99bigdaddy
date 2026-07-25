const toMoney = (value) => {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
}

const calculateRemainingUsageAmount = ({
    approvedDeposits = 0,
    gameBets = 0,
    copyGamingPrincipal = 0,
} = {}) => {
    const requiredUsage = Math.max(toMoney(approvedDeposits), 0);
    const completedUsage = Math.max(toMoney(gameBets), 0)
        + Math.max(toMoney(copyGamingPrincipal), 0);

    return toMoney(Math.max(requiredUsage - completedUsage, 0));
}

export {
    calculateRemainingUsageAmount,
};
