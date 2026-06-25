console.log("Mr Phone Homepage Engine Loaded");

window.MrPhone = {
  api: "https://homepages-tr76.onrender.com",

  carousels: [
    { wrapper:"carousel1-wrapper", swiperId:"carousel1-swiper", next:"carousel1-next", prev:"carousel1-prev", cats:[6,134,274,135] },
    { wrapper:"carousel2-wrapper", swiperId:"carousel2-swiper", next:"carousel2-next", prev:"carousel2-prev", cats:[257,143,348,281,272] },
    { wrapper:"carousel3-wrapper", swiperId:"carousel3-swiper", next:"carousel3-next", prev:"carousel3-prev", cats:[48,402,82,80,18] },
    { wrapper:"carousel4-wrapper", swiperId:"carousel4-swiper", next:"carousel4-next", prev:"carousel4-prev", cats:[241,142,389,306,313] },
    { wrapper:"carousel5-wrapper", swiperId:"carousel5-swiper", next:"carousel5-next", prev:"carousel5-prev", cats:[130,252,56,140,285] },
    { wrapper:"carousel6-wrapper", swiperId:"carousel6-swiper", next:"carousel6-next", prev:"carousel6-prev", cats:[117,236,42,41] },
    { wrapper:"carousel7-wrapper", swiperId:"carousel7-swiper", next:"carousel7-next", prev:"carousel7-prev", cats:[54,55,401] },
    { wrapper:"carousel8-wrapper", swiperId:"carousel8-swiper", next:"carousel8-next", prev:"carousel8-prev", cats:[28,27,320,428,321,322,325,373,58,234,319,77,69] },
    { wrapper:"carousel9-wrapper", swiperId:"carousel9-swiper", next:"carousel9-next", prev:"carousel9-prev", cats:[422,423,412,414,415,418,419,416,420] },
    { wrapper:"carousel10-wrapper", swiperId:"carousel10-swiper", next:"carousel10-next", prev:"carousel10-prev", cats:[20,21,29,14,359,75,52] },
    { wrapper:"carousel11-wrapper", swiperId:"carousel11-swiper", next:"carousel11-next", prev:"carousel11-prev", cats:[66,123,68,79,124] },
    { wrapper:"carousel12-wrapper", swiperId:"carousel12-swiper", next:"carousel12-next", prev:"carousel12-prev", cats:[237,316,32,33] }
  ],

  money(price) {
    return "$" + Number(price || 0).toFixed(2);
  },

  async getProducts(cats, limit = 16) {
    const url = `${this.api}/api/homepage-section?cats=${cats.join(",")}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Cannot load products");
    return await res.json();
  },

  escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  productCard(product) {
    const id = this.escapeHtml(product.id);
    const name = this.escapeHtml(product.name || "");
    const price = Number(product.price || 0);
    const image = this.escapeHtml(product.image || "");
    const brand = this.escapeHtml(product.brand || "");
    const category = this.escapeHtml(product.category || "");
    const stock = Number(product.stock_balance || 0);
    const url = product.url || `/contents/product_view/${id}`;

    return `
      <div class="swiper-slide">
        <div class="mrp-fast-product product"
          data-product-id="${id}"
          data-image="${image}"
          data-price="${price}"
          data-name="${name}"
          data-brand="${brand}"
          data-category="${category}"
          data-stock-balance="${stock}">

          <a href="${url}" data-product-name="${name}" class="mrp-fast-link">
            <div class="mrp-fast-img-wrap">
              <img src="${image}" alt="${name}" loading="lazy">
            </div>
            <h6>${name}</h6>
          </a>

          <div class="mrp-fast-price">
            <span>${this.money(price)}</span>
          </div>

          <button data-name="sallamon" class="add-to-cart-btn btn btn-sm btn-primary text-uppercase font-weight-medium fs-16">
            <i class="fal fa-cart-plus mr-2"></i>Add to Cart
          </button>
        </div>
      </div>
    `;
  },

  async loadCarousel(item) {
    const wrapper = document.getElementById(item.wrapper);
    if (!wrapper) return;

    wrapper.innerHTML = `<div class="mrp-loading">Loading products...</div>`;

    try {
      const data = await this.getProducts(item.cats, 16);
      const products = data.products || [];

      if (!products.length) {
        wrapper.innerHTML = `<div class="mrp-loading">No products available.</div>`;
        return;
      }

      wrapper.innerHTML = products.map(p => this.productCard(p)).join("");

      new Swiper("#" + item.swiperId, {
        slidesPerView: 6,
        spaceBetween: 20,
        loop: false,
        grabCursor: true,
        autoplay: {
          delay: 4000,
          disableOnInteraction: false
        },
        navigation: {
          nextEl: "#" + item.next,
          prevEl: "#" + item.prev
        },
        breakpoints: {
          0: { slidesPerView: 1, spaceBetween: 10 },
          600: { slidesPerView: 2, spaceBetween: 10 },
          900: { slidesPerView: 3, spaceBetween: 15 },
          1100: { slidesPerView: 4, spaceBetween: 15 },
          1600: { slidesPerView: 5, spaceBetween: 15 }
        }
      });

    } catch (err) {
      console.error(err);
      wrapper.innerHTML = `<div class="mrp-loading mrp-error">Error loading products.</div>`;
    }
  },

  loadAllCarousels() {
    this.carousels.forEach((item, index) => {
      setTimeout(() => this.loadCarousel(item), index * 150);
    });
  }
};

document.addEventListener("DOMContentLoaded", function () {
  MrPhone.loadAllCarousels();
});
