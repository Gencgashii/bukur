import React from 'react';
import useReveal from '../hooks/useReveal';

/** Wraps children in a scroll-reveal container (see `.reveal` in luxury.css). */
const Reveal = ({ as: Tag = 'div', className = '', children, ...rest }) => {
  const ref = useReveal();
  return (
    <Tag ref={ref} className={`reveal ${className}`} {...rest}>
      {children}
    </Tag>
  );
};

export default Reveal;
