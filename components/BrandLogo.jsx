import { useApp } from '@app/context/AppContext';
import { Logo } from './Logo';

export function BrandLogo(props) {
    const { t } = useApp();
    return (
      <Logo
        name={t('brand.name')}
        academy={t('brand.academy')}
        by={t('brand.by')}
        {...props}
      />
    );
}
