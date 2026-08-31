// Official BUKUR product photography selected from bukur.co/xk.
const BUKUR_ASSETS = 'https://bukur-world.s3.eu-west-3.amazonaws.com/';
const productImage = (filename) => `${BUKUR_ASSETS}${filename}`;

const womenSizes = ['XS', 'S', 'M', 'L'];
const menSizes = ['S', 'M', 'L', 'XL'];

export const products = [
  {
    id: 1, name: 'Set 09 (Prom)', price: 149.99,
    image: productImage('IMG_1767.JPG-01KP3A9G29E09SDMX52ERGR5QZ.jpeg'),
    images: [productImage('IMG_1767.JPG-01KP3A9G29E09SDMX52ERGR5QZ.jpeg')],
    description: 'An elegant BUKUR occasion set, designed for a polished evening look.', category: 'Sets', gender: 'Women', sizes: womenSizes, inStock: true,
  },
  {
    id: 2, name: 'Set 08', price: 119.99,
    image: productImage('IMG_1742.JPG-01KP3A1HC9P658R2DKHTQT4KRN.jpeg'),
    images: [productImage('IMG_1742.JPG-01KP3A1HC9P658R2DKHTQT4KRN.jpeg')],
    description: 'A refined BUKUR set with a clean, contemporary silhouette.', category: 'Sets', gender: 'Women', sizes: womenSizes, inStock: true,
  },
  {
    id: 3, name: 'Set 07 (Prom)', price: 199.99,
    image: productImage('IMG_1739.JPG-01KP39TMXGTEZDVGXPQ932ZNWB.jpeg'),
    images: [productImage('IMG_1739.JPG-01KP39TMXGTEZDVGXPQ932ZNWB.jpeg')],
    description: 'A statement BUKUR prom set made for special occasions.', category: 'Sets', gender: 'Women', sizes: womenSizes, inStock: true,
  },
  {
    id: 4, name: 'Set 06 (Prom)', price: 199.99,
    image: productImage('IMG_1725.JPG-01KP39BJGFDXVZ9XW7ASQ71M25.jpeg'),
    images: [productImage('IMG_1725.JPG-01KP39BJGFDXVZ9XW7ASQ71M25.jpeg')],
    description: 'An elevated BUKUR set with an occasion-ready finish.', category: 'Sets', gender: 'Women', sizes: womenSizes, inStock: true,
  },
  {
    id: 5, name: 'Set 05 (Prom)', price: 149.99,
    image: productImage('IMG_1718.JPG-01KP38SGR8A3MSPY7A8PEBSEE1.jpeg'),
    images: [productImage('IMG_1718.JPG-01KP38SGR8A3MSPY7A8PEBSEE1.jpeg')],
    description: 'A versatile BUKUR prom set with a graceful shape.', category: 'Sets', gender: 'Women', sizes: womenSizes, inStock: true,
  },
  {
    id: 6, name: 'Fustan 2207/148', price: 149.99,
    image: productImage('IMG_9944.JPG-01KKM4NRCGSPFZJBVJS0ZNC1Y2.jpeg'),
    images: [productImage('IMG_9944.JPG-01KKM4NRCGSPFZJBVJS0ZNC1Y2.jpeg')],
    description: 'A signature BUKUR dress for an effortlessly elegant look.', category: 'Dresses', gender: 'Women', sizes: womenSizes, inStock: true,
  },
  {
    id: 7, name: 'Fustan 2207/141', price: 189.99,
    image: productImage('IMG_9831.JPG-01KKM4F6RCA24DKA40090FX0WD.jpeg'),
    images: [productImage('IMG_9831.JPG-01KKM4F6RCA24DKA40090FX0WD.jpeg')],
    description: 'A modern BUKUR dress with a refined occasionwear feel.', category: 'Dresses', gender: 'Women', sizes: womenSizes, inStock: true,
  },
  {
    id: 8, name: 'Fustan 2207/140', price: 189.99,
    image: productImage('IMG_9763.JPG-01KKM47YTA0T9YKA03C24VEV1.jpeg'),
    images: [productImage('IMG_9763.JPG-01KKM47YTA0T9YKA03C24VEV1.jpeg')],
    description: 'A contemporary BUKUR dress with an elegant, sculpted profile.', category: 'Dresses', gender: 'Women', sizes: womenSizes, inStock: true,
  },
  {
    id: 9, name: 'Set 08', price: 199.99,
    image: productImage('DSC02582.JPG-01KKM3TMQ418JKBMXMCCR77Q27.jpeg'),
    images: [productImage('DSC02582.JPG-01KKM3TMQ418JKBMXMCCR77Q27.jpeg')],
    description: 'A tailored BUKUR set from the men’s collection.', category: 'Sets', gender: 'Men', sizes: menSizes, inStock: true,
  },
  {
    id: 10, name: 'Set 07', price: 199.99,
    image: productImage('DSC02502.JPG-01KKM3QS7F2RB1MQGSMF1J3QEC.jpeg'),
    images: [productImage('DSC02502.JPG-01KKM3QS7F2RB1MQGSMF1J3QEC.jpeg')],
    description: 'A sharp BUKUR men’s set designed for a complete look.', category: 'Sets', gender: 'Men', sizes: menSizes, inStock: true,
  },
  {
    id: 11, name: 'Set 06', price: 199.99,
    image: productImage('DSC02449.JPG-01KKM3MYPAMCM2DH1M1FXN4AJT.jpeg'),
    images: [productImage('DSC02449.JPG-01KKM3MYPAMCM2DH1M1FXN4AJT.jpeg')],
    description: 'A polished BUKUR men’s set for contemporary dressing.', category: 'Sets', gender: 'Men', sizes: menSizes, inStock: true,
  },
  {
    id: 12, name: 'Set 05', price: 199.99,
    image: productImage('DSC02379.JPG-01KKM3H9QH63K7YGGNXN5TJHP3.jpeg'),
    images: [productImage('DSC02379.JPG-01KKM3H9QH63K7YGGNXN5TJHP3.jpeg')],
    description: 'A sophisticated BUKUR set with a confident silhouette.', category: 'Sets', gender: 'Men', sizes: menSizes, inStock: true,
  },
];
