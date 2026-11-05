/**
 * Stands in for jsPDF's optional dependencies.
 *
 * jsPDF imports html2canvas and dompurify for its `.html()` helper, which
 * rasterises a DOM tree. This app draws the PDF from measured geometry
 * instead, so that helper is never called — but bundling the two libraries
 * anyway added about 190KB gzipped to the export chunk, downloaded over mobile
 * data by someone who only wanted a menu. They are aliased to this module in
 * vite.config.ts.
 *
 * If `.html()` is ever used, remove the aliases; it will throw without them.
 */
export default {}
