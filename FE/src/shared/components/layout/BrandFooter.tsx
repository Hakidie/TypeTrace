/** Bottom bar with the copyright line, matching `BrandHeader`. */
export const BrandFooter = () => (
  <footer className="border-t px-4 py-4 text-center text-sm text-muted-foreground md:px-8">
    © {new Date().getFullYear()} TypeTrace. All rights reserved.
  </footer>
);
