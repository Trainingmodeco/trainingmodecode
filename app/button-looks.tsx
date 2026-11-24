import Head from 'expo-router/head';
import { useLocalSearchParams } from 'expo-router';
import ButtonLooks from '@/components/training-mode/button-looks/ButtonLooks';

// Quick Mission's buttons, drawn four ways (looks only: the real screens with
// sample data, the app's own buttons untouched). Hidden: not linked, not
// indexed. ?look=<now|raised|round|neon|full>&panel=<setup|library|end|kit>
// draws one panel full screen; with no params it lists them.
export default function ButtonLooksRoute() {
  const { look, panel } = useLocalSearchParams<{ look?: string; panel?: string }>();
  return (
    <>
      <Head>
        <title>Button looks · Training Mode</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <ButtonLooks look={typeof look === 'string' ? look : undefined} panel={typeof panel === 'string' ? panel : undefined} />
    </>
  );
}
