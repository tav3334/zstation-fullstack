import DOMPurify from 'dompurify';

/**
 * Hook to sanitize user input and prevent XSS attacks
 * @param {string} dirty - The potentially dangerous HTML/text
 * @param {object} config - DOMPurify configuration options
 * @returns {string} - Sanitized safe HTML/text
 */
export const useSanitize = () => {
  const sanitize = (dirty, config = {}) => {
    if (!dirty) return '';

    // Default configuration: strip all HTML tags for plain text
    const defaultConfig = {
      ALLOWED_TAGS: [], // No HTML tags allowed by default
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true, // Keep text content even when stripping tags
      ...config
    };

    return DOMPurify.sanitize(dirty, defaultConfig);
  };

  // Sanitize but allow some safe HTML (like <b>, <i>, <br>)
  const sanitizeHtml = (dirty) => {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
      ALLOWED_ATTR: []
    });
  };

  return { sanitize, sanitizeHtml };
};

export default useSanitize;
