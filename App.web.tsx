import {useEffect} from 'react';

// Web is the public download site. Never mount the account/dashboard tree.
// Production is exported as static HTML by build-public-site.mjs; this also
// gives local Expo web previews the same public entry point.
export default function PublicWebsite() {
  useEffect(() => {
    window.location.replace('/landing.html');
  }, []);
  return null;
}
