import { useTranslation } from 'react-i18next';

/** Bottom bar with the copyright line, matching `BrandHeader`. */
export const BrandFooter = () => {
  const { t } = useTranslation();
  return (
    <footer className="border-t px-4 py-4 text-center text-sm text-muted-foreground md:px-8">
      {t('brand.footer', { year: new Date().getFullYear() })}
    </footer>
  );
};
