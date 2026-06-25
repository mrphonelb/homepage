console.log("Mr Phone Homepage Engine Loaded");

window.MrPhone = {

    api: "https://homepages-tr76.onrender.com",

    async getProducts(cats, limit = 12) {

        const url =
            `${this.api}/api/homepage-section?cats=${cats.join(",")}&limit=${limit}`;

        const response = await fetch(url);

        if (!response.ok)
            throw new Error("Cannot load products");

        return await response.json();
    }

};
