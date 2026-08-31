# BUKUR - E-commerce Website

A modern, minimalist e-commerce website for BUKUR clothing brand built with React.js.

## Features

- 🛍️ **Full E-commerce Functionality**
  - Product browsing and filtering
  - Product detail pages with image galleries
  - Shopping cart with quantity management
  - Complete checkout process
  - Order confirmation

- 🎨 **Modern Minimalist Design**
  - Clean, contemporary UI
  - Responsive design for all devices
  - Smooth animations and transitions
  - Professional typography

- 🚀 **React Features**
  - React Router for navigation
  - Context API for cart state management
  - Local storage persistence
  - Component-based architecture

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── Header.js
│   ├── Footer.js
│   └── ProductCard.js
├── pages/           # Page components
│   ├── Home.js
│   ├── Products.js
│   ├── ProductDetail.js
│   ├── Cart.js
│   └── Checkout.js
├── context/          # React Context
│   └── CartContext.js
├── data/             # Sample data
│   └── products.js
├── App.js            # Main app component
└── index.js          # Entry point
```

## Customization

### Adding Products

Edit `src/data/products.js` to add or modify products. Each product should have:
- `id`: Unique identifier
- `name`: Product name
- `price`: Price in euros
- `image`: Main product image URL
- `images`: Array of image URLs
- `description`: Product description
- `category`: Product category
- `sizes`: Available sizes
- `inStock`: Boolean for availability

### Styling

The design uses CSS custom properties defined in `src/index.css`. Modify these variables to change the color scheme:

```css
--primary-color: #000000;
--secondary-color: #ffffff;
--accent-color: #f5f5f5;
--text-color: #1a1a1a;
```

### Contact Information

Update the contact information in `src/components/Footer.js` with your actual details.

## Technologies Used

- React 18
- React Router DOM
- CSS3 (Custom Properties, Grid, Flexbox)
- Local Storage API

## License

© 2026 BUKUR. All rights reserved.
