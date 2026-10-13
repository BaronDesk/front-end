import { EmptyScreen } from '../../../components/composites/EmptyScreen';
import { ButtonLink } from '../../../components/primitives/Button';
import styles from './NotFoundPage.module.css';

/** Any portal address without a page, in the design's style. */
export function NotFoundPage() {
  return (
    <EmptyScreen title="Lost ?" text="There is no page at this address.">
      <ButtonLink to="/" size="lg" className={styles.home}>
        Back home
      </ButtonLink>
    </EmptyScreen>
  );
}
