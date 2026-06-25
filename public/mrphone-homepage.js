console.log("Mr Phone Homepage Engine Loaded");

window.MrPhone = {
  api: "https://homepages-tr76.onrender.com",

  async getProducts(cats, limit = 12) {
    const url =
      `${this.api}/api/homepage-section?cats=${cats.join(",")}&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Cannot load products");
    }

    return await response.json();
  },

  money(price) {
    return "$" + Number(price || 0).toFixed(2);
  },

  productCard(product) {
    const name = product.name || "";
    const price = Number(product.price || 0);
    const image = product.image || "";
    const brand = product.brand || "";
    const category = product.category || "";
    const stock = Number(product.stock_balance || 0);
    const url = product.url || `/contents/product_view/${product.id}`;

    return `
      <div class="swiper-slide">
        <div class="align-items-start d-flex flex-column h-100 mb-6 mb-lg-0 product px-5 px-lg-0 pb-4"
             data-product-id="${product.id}"
             data-image="${image}"
             data-price="${price}"
             data-name="${name}"
             data-brand="${brand}"
             data-category="${category}"
             data-stock-balance="${stock}">

          <a href="${url}"
             data-product-name="${name}"
             class="text-decoration-none text-primary text-hover-black"
             style="pointer-events:auto;">

            <img src="${image}"
                 alt="${name}"
                 class="product-img-sm img-fluid h-180px w-100 mx-auto img-cover mb-3"
                 loading="lazy">

            <h6 class="fs-18 font-weight-bold mb-2">${name}</h6>
          </a>

          <div class="mb-3 font-weight-bold mt-auto">
            <span class="text-black fs-24">${this.money(price)}</span>
          </div>

          <button data-name="sallamon"
                  class="add-to-cart-btn btn btn-sm btn-primary text-uppercase font-weight-medium fs-16"
                  style="pointer-events:auto;">
            <i class="fal fa-cart-plus mr-2"></i>Add to Cart
          </button>
        </div>
      </div>
    `;
  },

  async loadSimpleProducts(options) {
    const target = document.querySelector(options.target);
    if (!target) return;

    target.innerHTML = "Loading products...";

    try {
      const data = await this.getProducts(options.cats, options.limit || 12);
      const products = data.products || [];

      target.innerHTML = products.map(p => this.productCard(p)).join("");

    } catch (error) {
      console.error(error);
      target.innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
  }
};

  .mrp-products-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
    gap:20px;
    margin:30px 0;
}

.mrp-products-grid .product{
    background:#fff;
    border-radius:22px;
    box-shadow:0 8px 25px rgba(0,0,0,.08);
    padding:20px;
    transition:.25s;
}

.mrp-products-grid .product:hover{
    transform:translateY(-5px);
}

.mrp-products-grid img{
    width:100%;
    height:220px;
    object-fit:contain;
}

.mrp-products-grid h6{
    min-height:72px;
    font-size:18px;
    text-align:center;
    margin-top:15px;
}

.mrp-products-grid .text-black{
    font-size:34px;
    font-weight:700;
    display:block;
    text-align:center;
}

.mrp-products-grid .add-to-cart-btn{
    width:100%;
}
