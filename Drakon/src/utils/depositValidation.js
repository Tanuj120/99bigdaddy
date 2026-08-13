export const MINIMUM_DEPOSIT_AMOUNT = 100;
export const MINIMUM_USD_DEPOSIT_AMOUNT = 1;
export const USDT_TO_INR_RATE = 100;
export const USDT_DECIMAL_PLACES = 8;

export const normalizeUsdtAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount)
        ? Number(amount.toFixed(USDT_DECIMAL_PLACES))
        : 0;
}

export const convertUsdtToInr = (value) => {
    return Number((normalizeUsdtAmount(value) * USDT_TO_INR_RATE).toFixed(2));
}

export const isValidInrDepositAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= MINIMUM_DEPOSIT_AMOUNT;
}

export const isValidUsdtDepositAmount = (value) => {
    const amount = normalizeUsdtAmount(value);
    return amount >= MINIMUM_USD_DEPOSIT_AMOUNT
        && isValidInrDepositAmount(convertUsdtToInr(amount));
}
