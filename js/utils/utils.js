function parseJSON(text) {
    try {
        const parsed = JSON.parse(text);
        return parsed;
    } catch (e) {
        console.error(e);
    }
    return undefined;
}

function changeDelay() {
    let timer = 0;
    return (callback, ms) => {
        clearTimeout(timer);
        timer = setTimeout(callback, ms);
    };
}

const utils = {
    parseJSON,
    changeDelay,
};

export default utils;
