/**
 * Share-as-image browser half.
 *
 * Adds a picture action to every finalized assistant reply, renders the
 * selected messages into a PNG card with Canvas 2D, and previews it in the
 * frame-wide overlay with Download and Copy actions.
 */
window.__ModuleLoader__.load({
  id: '@showin2333/dsh-plugin-share-image',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'plugin.share-image';

    /** Localized copy; replaced by the locale-bound translator in apply(). */
    let translate = (key) => key;

    const EMPTY_NODES = [];
    const noopUseChat = (selector) => selector({ legacy: { nodes: EMPTY_NODES, partial: null } });
    const noopUseSessions = (selector) => selector({ byId: {} });
    const noopUseSession = (selector) => selector({});

    const SANS =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
    const MONO =
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

    const CARD = {
      width: 390,
      pad: 22,
      maxHeight: 6200,
      brand: '#4d6bfe',
    };

    const COLORS = {
      ink: '#14171c',
      body: '#1f2328',
      meta: '#8a919c',
      divider: '#eef0f4',
      marker: '#6b7280',
      codeBg: '#f6f7f9',
      codeBorder: '#e8eaef',
      codeText: '#374151',
      quoteBar: '#d8dee9',
      quoteText: '#5b6472',
      warnBg: '#fff8ed',
      warnBorder: '#fbe2c0',
      warnText: '#b45309',
    };

    /** Assistant text palette (default) and the inverted palette for the bubble. */
    const ASSISTANT_THEME = {
      heading: COLORS.ink,
      body: COLORS.body,
      marker: COLORS.marker,
      quoteBar: COLORS.quoteBar,
      quoteText: COLORS.quoteText,
      codeBg: COLORS.codeBg,
      codeBorder: COLORS.codeBorder,
      codeText: COLORS.codeText,
    };

    const BUBBLE_THEME = {
      heading: '#ffffff',
      body: '#ffffff',
      marker: 'rgba(255, 255, 255, 0.72)',
      quoteBar: 'rgba(255, 255, 255, 0.55)',
      quoteText: 'rgba(255, 255, 255, 0.9)',
      codeBg: 'rgba(255, 255, 255, 0.16)',
      codeBorder: 'rgba(255, 255, 255, 0.26)',
      codeText: '#f4f7ff',
    };

    /** Official DSH whale mark: single path from the bundled 50×50 favicon. */
    const WHALE_PATH = 'M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z';

    /** Official brand lockup, extracted from the app's welcome-brand.svg. */
    const BRAND_BOX = { x: 145.24, y: 11.5, w: 181.43, h: 18.14 };
    const BRAND_BADGE = { x: 274.674, y: 13.5, w: 52, h: 14, r: 2 };
    const BRAND_WORDMARK = [
      'M213.743 26.2447H212.377V24.1272H213.743C214.589 24.1272 215.443 23.9163 215.994 23.3304C216.545 22.7444 216.753 21.8455 216.753 20.9471C216.753 20.0487 216.554 19.1498 215.994 18.5643C215.435 17.9783 214.589 17.7674 213.743 17.7674C212.897 17.7674 212.042 17.9783 211.491 18.5643C210.94 19.1503 210.732 20.0487 210.732 20.9471V29.6435H208.336V15.6582H210.732V16.5488H211.171C211.219 16.4939 211.266 16.4473 211.314 16.4006C211.914 15.8535 212.832 15.6582 213.734 15.6582C215.148 15.6582 216.561 16.01 217.488 16.9866C218.414 17.9632 218.741 19.4632 218.741 20.9558C218.741 22.4485 218.405 23.9406 217.488 24.925C216.569 25.9094 215.148 26.2457 213.743 26.2457V26.2447Z',
      'M177.282 16.0355H178.647V18.153H177.282C176.436 18.153 175.581 18.3638 175.03 18.9498C174.479 19.5358 174.272 20.4347 174.272 21.3331C174.272 22.2315 174.472 23.1299 175.03 23.7159C175.589 24.3018 176.436 24.5127 177.282 24.5127C178.128 24.5127 178.983 24.3018 179.534 23.7159C180.085 23.1299 180.293 22.2315 180.293 21.3331V12.6289H182.688V26.6224H180.293V25.7318H179.853C179.805 25.7862 179.758 25.8334 179.709 25.88C179.11 26.4266 178.192 26.6224 177.29 26.6224C175.876 26.6224 174.463 26.2711 173.537 25.2945C172.611 24.3179 172.283 22.8175 172.283 21.3253C172.283 19.8331 172.618 18.3405 173.537 17.3561C174.463 16.3795 175.876 16.0355 177.282 16.0355Z',
      'M194.706 21.1444V21.9962H188.325V20.3009H192.557C192.462 19.6838 192.238 19.1056 191.839 18.6834C191.264 18.0741 190.377 17.8554 189.499 17.8554C188.621 17.8554 187.735 18.0741 187.16 18.6834C186.585 19.2927 186.377 20.2227 186.377 21.1449C186.377 22.0671 186.584 23.0044 187.16 23.6059C187.735 24.2074 188.621 24.4343 189.499 24.4343C190.378 24.4343 191.264 24.2157 191.839 23.6059C191.918 23.5199 191.99 23.4261 192.062 23.3323H194.426C194.219 24.067 193.891 24.7312 193.396 25.2467C192.438 26.2545 190.961 26.6218 189.499 26.6218C188.038 26.6218 186.561 26.2622 185.602 25.2467C184.644 24.2312 184.293 22.6842 184.293 21.1449C184.293 19.6056 184.636 18.0508 185.602 17.043C186.569 16.0353 188.038 15.668 189.499 15.668C190.961 15.668 192.438 16.0275 193.396 17.043C194.362 18.0585 194.706 19.6056 194.706 21.1449V21.1444Z',
      'M206.731 21.1444V21.9962H200.351V20.3009H204.583C204.487 19.6838 204.264 19.1056 203.864 18.6834C203.289 18.0741 202.403 17.8554 201.525 17.8554C200.647 17.8554 199.76 18.0741 199.185 18.6834C198.61 19.2927 198.402 20.2227 198.402 21.1449C198.402 22.0671 198.61 23.0044 199.185 23.6059C199.76 24.2074 200.647 24.4343 201.525 24.4343C202.403 24.4343 203.289 24.2157 203.864 23.6059C203.944 23.5199 204.016 23.4261 204.087 23.3323H206.452C206.244 24.067 205.916 24.7312 205.421 25.2467C204.463 26.2545 202.986 26.6218 201.525 26.6218C200.064 26.6218 198.586 26.2622 197.628 25.2467C196.67 24.2312 196.318 22.6842 196.318 21.1449C196.318 19.6056 196.662 18.0508 197.628 17.043C198.594 16.0353 200.063 15.668 201.525 15.668C202.986 15.668 204.463 16.0275 205.421 17.043C206.387 18.0585 206.731 19.6056 206.731 21.1449V21.1444Z',
      'M225.57 26.6228C227.031 26.6228 228.508 26.4119 229.466 25.8104C230.424 25.2088 230.776 24.2944 230.776 23.3882C230.776 22.482 230.432 21.5598 229.466 20.9661C228.508 20.3723 227.031 20.1532 225.57 20.1532C224.946 20.1532 224.371 20.0672 223.964 19.8408C223.557 19.6061 223.405 19.2548 223.405 18.903C223.405 18.5512 223.549 18.1921 223.964 17.9652C224.371 17.7306 225.003 17.6528 225.625 17.6528C226.247 17.6528 226.879 17.7388 227.287 17.9652C227.694 18.1999 227.845 18.5512 227.845 18.903H230.281C230.281 17.9963 229.97 17.0746 229.1 16.4809C228.229 15.8871 226.896 15.668 225.57 15.668C224.245 15.668 222.911 15.8788 222.041 16.4809C221.17 17.0824 220.858 17.9963 220.858 18.903C220.858 19.8097 221.17 20.7314 222.041 21.3251C222.911 21.9189 224.244 22.138 225.57 22.138C226.257 22.138 227.016 22.224 227.47 22.4505C227.926 22.6774 228.086 23.0364 228.086 23.3882C228.086 23.74 227.926 24.0991 227.47 24.326C227.016 24.5524 226.321 24.6384 225.634 24.6384C224.948 24.6384 224.245 24.5524 223.797 24.326C223.35 24.0996 223.182 23.74 223.182 23.3882H220.371C220.371 24.2949 220.714 25.2166 221.681 25.8104C222.647 26.4041 224.109 26.6228 225.57 26.6228H225.57Z',
      'M242.801 21.1444V21.9962H236.421V20.3009H240.653C240.557 19.6838 240.333 19.1056 239.934 18.6834C239.359 18.0741 238.473 17.8554 237.594 17.8554C236.715 17.8554 235.829 18.0741 235.254 18.6834C234.68 19.2927 234.473 20.2227 234.473 21.1449C234.473 22.0671 234.68 23.0044 235.254 23.6059C235.829 24.2074 236.716 24.4343 237.594 24.4343C238.472 24.4343 239.359 24.2157 239.934 23.6059C240.014 23.5199 240.086 23.4261 240.158 23.3323H242.521C242.313 24.067 241.986 24.7312 241.491 25.2467C240.533 26.2545 239.056 26.6218 237.594 26.6218C236.132 26.6218 234.656 26.2622 233.698 25.2467C232.739 24.2312 232.389 22.6842 232.389 21.1449C232.389 19.6056 232.732 18.0508 233.698 17.043C234.664 16.0353 236.133 15.668 237.594 15.668C239.055 15.668 240.533 16.0275 241.491 17.043C242.457 18.0585 242.8 19.6056 242.8 21.1449L242.801 21.1444Z',
      'M254.827 21.1444V21.9962H248.446V20.3009H252.679C252.583 19.6838 252.359 19.1056 251.96 18.6834C251.385 18.0741 250.499 17.8554 249.62 17.8554C248.741 17.8554 247.856 18.0741 247.281 18.6834C246.706 19.2927 246.498 20.2227 246.498 21.1449C246.498 22.0671 246.706 23.0044 247.281 23.6059C247.856 24.2074 248.742 24.4343 249.62 24.4343C250.498 24.4343 251.385 24.2157 251.96 23.6059C252.04 23.5199 252.111 23.4261 252.184 23.3323H254.547C254.339 24.067 254.012 24.7312 253.518 25.2467C252.559 26.2545 251.082 26.6218 249.62 26.6218C248.159 26.6218 246.682 26.2622 245.724 25.2467C244.766 24.2312 244.414 22.6842 244.414 21.1449C244.414 19.6056 244.757 18.0508 245.724 17.043C246.69 16.0353 248.159 15.668 249.62 15.668C251.081 15.668 252.558 16.0275 253.518 17.043C254.484 18.0585 254.827 19.6056 254.827 21.1449V21.1444Z',
      'M258.827 12.6289H256.432V26.6224H258.827V12.6289Z',
      'M262.917 20.8169L266.844 26.6222H263.882L259.953 20.8169L263.882 16.1523H266.844L262.917 20.8169Z',
    ];
    const BRAND_LOCKUP_WHALE = 'M168.384 12.9517C168.138 12.8317 168.033 13.0607 167.889 13.1767C167.84 13.2142 167.799 13.2632 167.757 13.3082C167.399 13.6912 166.98 13.9427 166.433 13.9127C165.632 13.8677 164.949 14.1192 164.345 14.7312C164.217 13.9767 163.79 13.5262 163.141 13.2372C162.802 13.0872 162.458 12.9367 162.22 12.6102C162.054 12.3776 162.009 12.1186 161.926 11.8631C161.873 11.7091 161.82 11.5516 161.643 11.5251C161.45 11.4951 161.375 11.6566 161.299 11.7916C160.997 12.3436 160.88 12.9517 160.892 13.5677C160.918 14.9532 161.503 16.0568 162.666 16.8418C162.798 16.9318 162.832 17.0218 162.79 17.1533C162.711 17.4238 162.617 17.6863 162.534 17.9568C162.481 18.1293 162.402 18.1673 162.217 18.0918C161.579 17.8253 161.028 17.4308 160.541 16.9543C159.714 16.1548 158.967 15.2722 158.035 14.5812C157.816 14.4197 157.597 14.2697 157.37 14.1267C156.419 13.2032 157.495 12.4446 157.744 12.3546C158.004 12.2606 157.834 11.9376 156.993 11.9416C156.151 11.9451 155.381 12.2271 154.4 12.6027C154.256 12.6592 154.105 12.7002 153.951 12.7342C153.06 12.5652 152.135 12.5277 151.169 12.6367C149.35 12.8392 147.897 13.6992 146.829 15.1672C145.546 16.9318 145.244 18.9368 145.613 21.0279C146.002 23.232 147.127 25.0565 148.855 26.4831C150.648 27.9621 152.713 28.6871 155.068 28.5481C156.499 28.4656 158.091 28.2741 159.888 26.7536C160.341 26.9791 160.816 27.0691 161.605 27.1366C162.212 27.1931 162.797 27.1066 163.25 27.0126C163.96 26.8626 163.911 26.2056 163.654 26.0851C161.575 25.1165 162.031 25.5105 161.616 25.1915C162.673 23.9415 164.287 21.7194 164.785 18.6938C164.834 18.3598 164.896 17.8893 164.889 17.6188C164.885 17.4538 164.923 17.3898 165.111 17.3708C165.632 17.3108 166.138 17.1683 166.603 16.9128C167.95 16.1768 168.494 14.9677 168.622 13.5187C168.641 13.2972 168.618 13.0682 168.384 12.9517ZM156.642 25.9951C154.626 24.4105 153.649 23.889 153.245 23.9115C152.868 23.934 152.936 24.366 153.019 24.6475C153.106 24.9255 153.219 25.117 153.377 25.361C153.487 25.5225 153.562 25.7625 153.268 25.9431C152.619 26.3446 151.49 25.808 151.437 25.7815C150.124 25.008 149.025 23.987 148.251 22.5905C147.504 21.2464 147.07 19.8044 146.998 18.2653C146.979 17.8938 147.089 17.7623 147.459 17.6948C147.946 17.6048 148.448 17.5858 148.934 17.6573C150.992 17.9578 152.743 18.8773 154.211 20.3344C155.049 21.1639 155.683 22.1554 156.336 23.124C157.03 24.1525 157.777 25.1325 158.729 25.9361C159.065 26.2176 159.333 26.4316 159.589 26.5896C158.816 26.6761 157.525 26.6946 156.642 25.9961V25.9951ZM157.608 19.7814C157.608 19.6164 157.74 19.4849 157.906 19.4849C157.943 19.4849 157.977 19.4924 158.008 19.5034C158.049 19.5184 158.087 19.5409 158.117 19.5749C158.17 19.6274 158.2 19.7024 158.2 19.7814C158.2 19.9464 158.068 20.0779 157.902 20.0779C157.736 20.0779 157.608 19.9464 157.608 19.7814ZM160.608 21.3204C160.416 21.3994 160.223 21.4669 160.038 21.4744C159.751 21.4894 159.438 21.3729 159.268 21.2304C159.004 21.0089 158.815 20.8849 158.736 20.4984C158.702 20.3334 158.721 20.0779 158.751 19.9314C158.819 19.6159 158.744 19.4134 158.521 19.2294C158.34 19.0793 158.11 19.0378 157.857 19.0378C157.762 19.0378 157.676 18.9963 157.611 18.9628C157.506 18.9103 157.419 18.7788 157.502 18.6173C157.528 18.5648 157.657 18.4373 157.687 18.4148C158.03 18.2193 158.426 18.2833 158.793 18.4298C159.132 18.5688 159.389 18.8238 159.759 19.1844C160.136 19.6199 160.204 19.7399 160.419 20.0669C160.589 20.3224 160.744 20.5849 160.85 20.8854C160.914 21.0729 160.831 21.2264 160.608 21.3204Z';
    const BRAND_BADGE_TEXT = [
      'M278.174 16.9328H279.406V24.1378H278.174V16.9328ZM281.826 16.9328H283.058V24.1378H281.826V16.9328ZM278.691 21.0248V19.9908H282.519V21.0248H278.691Z',
      'M285.723 22.4328L285.998 21.4538H288.528L288.858 22.4328H285.723ZM285.613 24.1378H284.381L286.603 16.9328H287.527L287.472 17.7468L286.273 21.9158H286.295L285.613 24.1378ZM290.365 24.1378H289.067L288.396 21.9488L288.407 21.9378L287.197 17.7468L287.252 16.9328H288.143L290.365 24.1378Z',
      'M292.172 16.9328H294.393C295.178 16.9328 295.768 17.1161 296.164 17.4828C296.56 17.8421 296.758 18.3334 296.758 18.9568C296.758 19.2208 296.722 19.4664 296.649 19.6938C296.575 19.9211 296.451 20.1264 296.274 20.3098C296.098 20.4931 295.857 20.6508 295.549 20.7828C295.248 20.9074 294.867 21.0064 294.405 21.0798V21.3218H292.172V20.6398L293.349 20.4858C293.957 20.4051 294.416 20.2988 294.724 20.1668C295.032 20.0348 295.24 19.8771 295.351 19.6938C295.461 19.5031 295.516 19.2941 295.516 19.0668C295.516 18.7001 295.409 18.4178 295.197 18.2198C294.984 18.0218 294.65 17.9228 294.195 17.9228H292.172V16.9328ZM291.72 16.9328H292.953V24.1378H291.72V16.9328ZM297.243 24.0938V24.1378H295.691L294.35 22.3228C294.196 22.1101 294.056 21.9414 293.932 21.8168C293.807 21.6848 293.671 21.5894 293.524 21.5308C293.378 21.4648 293.198 21.4208 292.986 21.3988C292.773 21.3694 292.502 21.3511 292.172 21.3438V21.1458H294.405C294.559 21.2118 294.694 21.2851 294.812 21.3658C294.936 21.4464 295.061 21.5454 295.186 21.6628C295.318 21.7801 295.464 21.9378 295.625 22.1358L297.243 24.0938Z',
      'M298.906 17.5708L298.917 16.9328H299.786L302.91 23.5108V24.1378H302.03L298.906 17.5708ZM303.35 24.1378H302.294L302.206 16.9328H303.35V24.1378ZM299.566 24.1378H298.422V16.9328H299.478L299.566 24.1378Z',
      'M305.289 16.9328H306.532V24.1378H305.289V16.9328ZM305.421 17.9668V16.9328H310.184V17.9668H305.421ZM305.421 24.1378V23.1038H310.228V24.1378H305.421ZM305.421 21.0138V19.9908H309.7V21.0138H305.421Z',
      'M314.378 23.2578C314.869 23.2578 315.221 23.1661 315.434 22.9828C315.654 22.7994 315.764 22.5464 315.764 22.2238C315.764 22.0478 315.731 21.8974 315.665 21.7728C315.599 21.6481 315.478 21.5344 315.302 21.4318C315.133 21.3218 314.884 21.2154 314.554 21.1128L313.817 20.8818C313.172 20.6764 312.706 20.4051 312.42 20.0678C312.134 19.7304 311.991 19.3014 311.991 18.7808C311.991 18.4288 312.086 18.1024 312.277 17.8018C312.468 17.5011 312.754 17.2591 313.135 17.0758C313.516 16.8924 313.989 16.8008 314.554 16.8008C314.957 16.8008 315.324 16.8301 315.654 16.8888C315.991 16.9401 316.365 17.0171 316.776 17.1198L316.6 18.1758C316.16 18.0511 315.768 17.9631 315.423 17.9118C315.086 17.8531 314.789 17.8238 314.532 17.8238C314.063 17.8238 313.729 17.9081 313.531 18.0768C313.333 18.2381 313.234 18.4398 313.234 18.6818C313.234 18.8578 313.267 19.0154 313.333 19.1548C313.399 19.2868 313.516 19.4078 313.685 19.5178C313.861 19.6278 314.11 19.7341 314.433 19.8368L315.192 20.0788C315.852 20.2768 316.321 20.5334 316.6 20.8488C316.879 21.1568 317.018 21.5858 317.018 22.1358C317.018 22.5611 316.915 22.9351 316.71 23.2578C316.505 23.5804 316.204 23.8334 315.808 24.0168C315.419 24.2001 314.935 24.2918 314.356 24.2918C313.953 24.2918 313.538 24.2478 313.113 24.1598C312.688 24.0718 312.226 23.9434 311.727 23.7748L311.991 22.7188C312.482 22.8948 312.926 23.0304 313.322 23.1258C313.725 23.2138 314.077 23.2578 314.378 23.2578Z',
      'M321.135 23.2578C321.626 23.2578 321.978 23.1661 322.191 22.9828C322.411 22.7994 322.521 22.5464 322.521 22.2238C322.521 22.0478 322.488 21.8974 322.422 21.7728C322.356 21.6481 322.235 21.5344 322.059 21.4318C321.89 21.3218 321.641 21.2154 321.311 21.1128L320.574 20.8818C319.929 20.6764 319.463 20.4051 319.177 20.0678C318.891 19.7304 318.748 19.3014 318.748 18.7808C318.748 18.4288 318.843 18.1024 319.034 17.8018C319.225 17.5011 319.511 17.2591 319.892 17.0758C320.273 16.8924 320.746 16.8008 321.311 16.8008C321.714 16.8008 322.081 16.8301 322.411 16.8888C322.748 16.9401 323.122 17.0171 323.533 17.1198L323.357 18.1758C322.917 18.0511 322.525 17.9631 322.18 17.9118C321.843 17.8531 321.546 17.8238 321.289 17.8238C320.82 17.8238 320.486 17.9081 320.288 18.0768C320.09 18.2381 319.991 18.4398 319.991 18.6818C319.991 18.8578 320.024 19.0154 320.09 19.1548C320.156 19.2868 320.273 19.4078 320.442 19.5178C320.618 19.6278 320.867 19.7341 321.19 19.8368L321.949 20.0788C322.609 20.2768 323.078 20.5334 323.357 20.8488C323.636 21.1568 323.775 21.5858 323.775 22.1358C323.775 22.5611 323.672 22.9351 323.467 23.2578C323.262 23.5804 322.961 23.8334 322.565 24.0168C322.176 24.2001 321.692 24.2918 321.113 24.2918C320.71 24.2918 320.295 24.2478 319.87 24.1598C319.445 24.0718 318.983 23.9434 318.484 23.7748L318.748 22.7188C319.239 22.8948 319.683 23.0304 320.079 23.1258C320.482 23.2138 320.834 23.2578 321.135 23.2578Z',
    ];

    let measureCanvas = null;
    function measureContext() {
      if (measureCanvas === null) {
        measureCanvas = document.createElement('canvas');
      }
      return measureCanvas.getContext('2d');
    }

    /* ------------------------------------------------------------------ *
     * Conversation snapshot -> plain messages
     * ------------------------------------------------------------------ */

    function textOfContent(content, labels) {
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      const parts = [];
      for (const block of content) {
        if (block === null || typeof block !== 'object') continue;
        if (block.type === 'text' && typeof block.text === 'string') {
          parts.push(block.text);
        } else if (block.type === 'image') {
          parts.push('[' + labels.image + ']');
        } else if (block.type === 'file') {
          parts.push('[' + labels.file + ']');
        }
      }
      return parts.join('\n');
    }

    function textOfBlocks(blocks) {
      if (!Array.isArray(blocks)) return '';
      let out = '';
      for (const block of blocks) {
        if (block === null || typeof block !== 'object') continue;
        if (block.kind === 'text' && typeof block.text === 'string') {
          out += (out === '' ? '' : '\n\n') + block.text;
        }
      }
      return out;
    }

    /**
     * Flatten the Chat target's finalized node list into selectable messages.
     * Tool calls, reasoning, system context, and command rows are intentionally
     * omitted. Each entry keeps its own identity so the picker can select an
     * arbitrary subset; merging happens only when the image is rendered.
     */
    function collectMessages(nodes, labels) {
      const entries = [];
      for (const node of Array.isArray(nodes) ? nodes : []) {
        if (node === null || typeof node !== 'object') continue;
        if (node.kind === 'user' || node.kind === 'steering') {
          const text = textOfContent(node.content, labels).trim();
          if (text !== '') {
            entries.push({
              id: 'u:' + String(node.seq),
              role: 'user',
              text,
              messageIds: [],
            });
          }
        } else if (node.kind === 'assistant') {
          const text = textOfBlocks(node.blocks).trim();
          if (text === '') continue;
          const messageId = typeof node.messageId === 'string' ? node.messageId : undefined;
          const last = entries[entries.length - 1];
          if (last !== undefined && last.role === 'assistant') {
            last.text = last.text + '\n\n' + text;
            if (messageId !== undefined) last.messageIds.push(messageId);
            continue;
          }
          entries.push({
            id: 'a:' + String(messageId === undefined ? node.seq : messageId),
            role: 'assistant',
            text,
            messageIds: messageId === undefined ? [] : [messageId],
          });
        }
      }
      return entries;
    }

    /** Selected entries in conversation order, with adjacent Assistant steps joined. */
    function mergeSelection(entries, selectedIds) {
      const selected = new Set(selectedIds);
      const messages = [];
      for (const entry of entries) {
        if (!selected.has(entry.id)) continue;
        const last = messages[messages.length - 1];
        if (entry.role === 'assistant' && last !== undefined && last.role === 'assistant') {
          last.text = last.text + '\n\n' + entry.text;
          continue;
        }
        messages.push({ role: entry.role, text: entry.text });
      }
      return messages;
    }

    /** One-line preview for a picker row. */
    function previewText(text) {
      const flat = inlineSource(text)
        .replace(/\*\*|__|~~|`/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return flat.length > 140 ? flat.slice(0, 139) + '\u2026' : flat;
    }

    function cardTitle(sessionTitle, t) {
      const trimmed = typeof sessionTitle === 'string' ? sessionTitle.trim() : '';
      return trimmed !== '' ? trimmed : t('card.defaultTitle');
    }

    /* ------------------------------------------------------------------ *
     * Text preparation
     * ------------------------------------------------------------------ */

    /** Entity/link/HTML cleanup that keeps emphasis markers for run parsing. */
    function inlineSource(text) {
      return String(text)
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    /** Split inline markdown into styled runs (bold only for now). */
    function inlineRuns(text) {
      const source = inlineSource(text);
      const runs = [];
      const pattern = /\*\*([^*]+)\*\*|__([^_]+)__/g;
      let cursor = 0;
      let match = pattern.exec(source);
      while (match !== null) {
        if (match.index > cursor) {
          runs.push({ text: source.slice(cursor, match.index), bold: false });
        }
        runs.push({ text: match[1] === undefined ? match[2] : match[1], bold: true });
        cursor = match.index + match[0].length;
        match = pattern.exec(source);
      }
      if (cursor < source.length) runs.push({ text: source.slice(cursor), bold: false });
      const out = [];
      for (const run of runs) {
        const clean = run.text.replace(/`([^`]+)`/g, '$1').replace(/~~([^~]+)~~/g, '$1');
        if (clean !== '') out.push({ text: clean, bold: run.bold });
      }
      return out;
    }

    function boldOf(font) {
      return /^\d{3} /.test(font) ? font : '700 ' + font;
    }

    const CLOSING_PUNCT = '\u3002\uff0c\u3001\uff1b\uff1a\uff1f\uff01\uff09\u3011\u300b\u300d\u300f\u201d\u2019\u2026,.;:?!)]}%';
    const OPENING_PUNCT = '\uff08\u3010\u300a\u300c\u300e\u201c\u2018([{';

    let wordSegmenter = null;

    function wordSegments(text) {
      if (
        wordSegmenter === null &&
        typeof Intl !== 'undefined' &&
        typeof Intl.Segmenter === 'function'
      ) {
        wordSegmenter = new Intl.Segmenter('zh', { granularity: 'word' });
      }
      if (wordSegmenter !== null) {
        const out = [];
        for (const part of wordSegmenter.segment(text)) out.push(part.segment);
        return out;
      }
      const fallback =
        /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef\u3040-\u30ff\uac00-\ud7af]|[^\s\u2e80-\u9fff\u3000-\u303f\uff00-\uffef\u3040-\u30ff\uac00-\ud7af]+|\s+/g;
      return text.match(fallback) || [];
    }

    function tokenizeRuns(measure, runs, baseFont, boldFont) {
      const tokens = [];
      for (const run of runs) {
        const font = run.bold ? boldFont : baseFont;
        measure.font = font;
        for (const piece of wordSegments(run.text)) {
          if (/^\s+$/.test(piece)) {
            if (tokens.length > 0 && tokens[tokens.length - 1].space) continue;
            tokens.push({ text: ' ', bold: false, space: true, width: measure.measureText(' ').width });
            continue;
          }
          tokens.push({ text: piece, bold: run.bold, space: false, width: measure.measureText(piece).width });
        }
      }
      return tokens;
    }

    function wrapTokens(tokens, maxWidth) {
      const lines = [];
      let line = [];
      let width = 0;
      const flush = () => {
        while (line.length > 0 && line[line.length - 1].space) line.pop();
        if (line.length > 0) lines.push(line);
        line = [];
        width = 0;
      };
      for (const token of tokens) {
        if (line.length === 0 && token.space) continue;
        if (line.length > 0 && width + token.width > maxWidth) {
          flush();
          if (token.space) continue;
        }
        line.push(token);
        width += token.width;
      }
      flush();

      for (let index = 1; index < lines.length; index += 1) {
        const current = lines[index];
        while (current.length > 0 && CLOSING_PUNCT.indexOf(current[0].text.charAt(0)) >= 0) {
          const previous = lines[index - 1];
          if (previous.length <= 1) break;
          current.unshift(previous.pop());
        }
      }
      for (let index = 0; index < lines.length - 1; index += 1) {
        const current = lines[index];
        const last = current[current.length - 1];
        if (
          last !== undefined &&
          !last.space &&
          current.length > 1 &&
          OPENING_PUNCT.indexOf(last.text.charAt(0)) >= 0
        ) {
          lines[index + 1].unshift(current.pop());
        }
      }
      return lines;
    }

    function emitRichLines(ops, lines, x, y, baseFont, boldFont, color, lineHeight, baselineOffset) {
      let cursor = y;
      for (const line of lines) {
        let px = x;
        for (const token of line) {
          if (!token.space) {
            ops.push({
              t: 'text',
              s: token.text,
              x: px,
              y: cursor + baselineOffset,
              f: token.bold ? boldFont : baseFont,
              c: color,
            });
          }
          px += token.width;
        }
        cursor += lineHeight;
      }
      return cursor;
    }

    function layoutInline(ops, text, x, y, width, measure, font, color, lineHeight, baselineOffset) {
      const boldFont = boldOf(font);
      const tokens = tokenizeRuns(measure, inlineRuns(text), font, boldFont);
      const lines = wrapTokens(tokens, width);
      return emitRichLines(ops, lines, x, y, font, boldFont, color, lineHeight, baselineOffset);
    }

    function layoutInlineLines(text, width, measure, font) {
      const boldFont = boldOf(font);
      const tokens = tokenizeRuns(measure, inlineRuns(text), font, boldFont);
      return { lines: wrapTokens(tokens, width), boldFont };
    }


    function isMarkerLine(line) {
      return (
        /^```/.test(line) ||
        /^#{1,6}\s+/.test(line) ||
        /^>\s?/.test(line) ||
        /^(\s*)([-*+]|\d{1,3}[.)])\s+/.test(line)
      );
    }

    /** Split message text into renderable blocks (code, headings, lists, quotes). */
    function parseBlocks(text) {
      const lines = String(text).replace(/\r\n/g, '\n').split('\n');
      const blocks = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const fence = /^```(.*)$/.exec(line);
        if (fence !== null) {
          i += 1;
          const body = [];
          while (i < lines.length && !/^```/.test(lines[i])) {
            body.push(lines[i]);
            i += 1;
          }
          i += 1;
          blocks.push({ kind: 'code', lang: fence[1].trim(), lines: body });
          continue;
        }
        if (line.trim() === '') {
          i += 1;
          continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading !== null) {
          blocks.push({ kind: 'heading', level: heading[1].length, text: inlineSource(heading[2]) });
          i += 1;
          continue;
        }
        if (/^>\s?/.test(line)) {
          const body = [];
          while (i < lines.length && /^>\s?/.test(lines[i])) {
            body.push(lines[i].replace(/^>\s?/, ''));
            i += 1;
          }
          blocks.push({ kind: 'quote', text: inlineSource(body.join('\n')) });
          continue;
        }
        const item = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/.exec(line);
        if (item !== null) {
          const marker = /^\d/.test(item[2]) ? item[2] : '\u2022';
          const body = [item[3]];
          i += 1;
          while (i < lines.length && lines[i].trim() !== '' && !isMarkerLine(lines[i])) {
            body.push(lines[i].trim());
            i += 1;
          }
          blocks.push({ kind: 'item', marker, text: inlineSource(body.join(' ')) });
          continue;
        }
        const body = [line];
        i += 1;
        while (i < lines.length && lines[i].trim() !== '' && !isMarkerLine(lines[i])) {
          body.push(lines[i]);
          i += 1;
        }
        blocks.push({ kind: 'p', text: inlineSource(body.join('\n')) });
      }
      return blocks;
    }

    /** Character-level wrapping that also breaks on spaces for Latin text. */
    function wrapText(measure, text, maxWidth, font) {
      measure.font = font;
      const out = [];
      for (const raw of String(text).split('\n')) {
        if (raw === '') {
          out.push('');
          continue;
        }
        let line = '';
        let lastSpace = -1;
        for (const ch of raw) {
          const candidate = line + ch;
          if (line !== '' && measure.measureText(candidate).width > maxWidth) {
            if (ch === ' ' || line.endsWith(' ')) {
              out.push(line.replace(/\s+$/, ''));
              line = ch === ' ' ? '' : ch;
            } else if (lastSpace > 0) {
              out.push(line.slice(0, lastSpace).replace(/\s+$/, ''));
              line = line.slice(lastSpace + 1) + ch;
            } else {
              out.push(line);
              line = ch;
            }
            lastSpace = line.lastIndexOf(' ');
          } else {
            line = candidate;
            if (ch === ' ') lastSpace = line.length - 1;
          }
        }
        out.push(line.replace(/\s+$/, ''));
      }
      return out;
    }

    /* ------------------------------------------------------------------ *
     * Card layout: produce drawing operations, then paint them
     * ------------------------------------------------------------------ */

    function emitLines(ops, lines, x, y, font, color, lineHeight, baselineOffset) {
      let cursor = y;
      for (const line of lines) {
        if (line !== '') {
          ops.push({ t: 'text', s: line, x, y: cursor + baselineOffset, f: font, c: color });
        }
        cursor += lineHeight;
      }
      return cursor;
    }

    function blockGap(block) {
      if (block.kind === 'item') return 8;
      if (block.kind === 'heading') return 14;
      return 15;
    }

    function layoutMessageBlocks(ops, blocks, startY, x, width, measure, theme) {
      const palette = theme === undefined ? ASSISTANT_THEME : theme;
      let y = startY;
      const lastIndex = blocks.length - 1;
      blocks.forEach((block, index) => {
        const trailing = index === lastIndex ? 0 : blockGap(block);
        if (block.kind === 'heading') {
          const size = block.level <= 1 ? 19 : block.level === 2 ? 17.5 : 16;
          const font = '700 ' + size + 'px ' + SANS;
          if (index > 0) y += 8;
          y = layoutInline(
            ops,
            block.text,
            x,
            y,
            width,
            measure,
            font,
            palette.heading,
            size + 11,
            size * 0.8 + 3,
          );
          y += index === lastIndex ? 0 : 6;
          return;
        }
        if (block.kind === 'code') {
          const font = '12.5px ' + MONO;
          const pad = 15;
          const lineHeight = 20;
          const lines = [];
          for (const raw of block.lines) {
            lines.push(...wrapText(measure, raw === '' ? ' ' : raw, width - pad * 2, font));
          }
          if (lines.length === 0) lines.push(' ');
          const height = pad * 2 + lines.length * lineHeight;
          ops.push({ t: 'rect', x, y, w: width, h: height, r: 10, c: palette.codeBg });
          ops.push({ t: 'stroke', x, y, w: width, h: height, r: 10, c: palette.codeBorder });
          let cursor = y + pad;
          for (const line of lines) {
            ops.push({
              t: 'text',
              s: line === '' ? ' ' : line,
              x: x + pad,
              y: cursor + 13.5,
              f: font,
              c: palette.codeText,
            });
            cursor += lineHeight;
          }
          y += height + trailing;
          return;
        }
        if (block.kind === 'quote') {
          const font = '15px ' + SANS;
          const lineHeight = 25;
          const quote = layoutInlineLines(block.text, width - 20, measure, font);
          ops.push({
            t: 'rect',
            x,
            y: y + 3,
            w: 3,
            h: Math.max(quote.lines.length * lineHeight - 8, 8),
            r: 1.5,
            c: palette.quoteBar,
          });
          y = emitRichLines(
            ops,
            quote.lines,
            x + 20,
            y,
            font,
            quote.boldFont,
            palette.quoteText,
            lineHeight,
            18,
          );
          y += trailing;
          return;
        }
        if (block.kind === 'item') {
          const font = '15px ' + SANS;
          const lineHeight = 26;
          const item = layoutInlineLines(block.text, width - 26, measure, font);
          ops.push({ t: 'text', s: block.marker, x, y: y + 18, f: font, c: palette.marker });
          y = emitRichLines(
            ops,
            item.lines,
            x + 26,
            y,
            font,
            item.boldFont,
            palette.body,
            lineHeight,
            18,
          );
          y += trailing;
          return;
        }
        const font = '15px ' + SANS;
        const lineHeight = 26;
        y = layoutInline(ops, block.text, x, y, width, measure, font, palette.body, lineHeight, 18);
        y += trailing;
      });
      return y;
    }

    function roundRectPath(ctx, x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.arcTo(x + w, y, x + w, y + radius, radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
      ctx.lineTo(x + radius, y + h);
      ctx.arcTo(x, y + h, x, y + h - radius, radius);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.closePath();
    }

    let brandInkPath = null;
    let brandBadgePath = null;

    function appendRoundedRect(path, x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      path.moveTo(x + radius, y);
      path.lineTo(x + w - radius, y);
      path.arcTo(x + w, y, x + w, y + radius, radius);
      path.lineTo(x + w, y + h - radius);
      path.arcTo(x + w, y + h, x + w - radius, y + h, radius);
      path.lineTo(x + radius, y + h);
      path.arcTo(x, y + h, x, y + h - radius, radius);
      path.lineTo(x, y + radius);
      path.arcTo(x, y, x + radius, y, radius);
      path.closePath();
    }

    function buildBrandPaths() {
      if (brandInkPath !== null || typeof Path2D === 'undefined') return;
      brandInkPath = new Path2D();
      brandInkPath.addPath(new Path2D(BRAND_LOCKUP_WHALE));
      for (const outline of BRAND_WORDMARK) {
        brandInkPath.addPath(new Path2D(outline));
      }
      appendRoundedRect(
        brandInkPath,
        BRAND_BADGE.x,
        BRAND_BADGE.y,
        BRAND_BADGE.w,
        BRAND_BADGE.h,
        BRAND_BADGE.r,
      );
      brandBadgePath = new Path2D();
      for (const outline of BRAND_BADGE_TEXT) {
        brandBadgePath.addPath(new Path2D(outline));
      }
    }

    /** Official whale + wordmark + HARNESS badge, anchored at its top-left. */
    function paintBrand(ctx, x, y, height, ink, badgeText) {
      buildBrandPaths();
      if (brandInkPath === null) return;
      const scale = height / BRAND_BOX.h;
      ctx.save();
      ctx.translate(x - BRAND_BOX.x * scale, y - BRAND_BOX.y * scale);
      ctx.scale(scale, scale);
      ctx.fillStyle = ink;
      ctx.fill(brandInkPath);
      ctx.fillStyle = badgeText;
      ctx.fill(brandBadgePath);
      ctx.restore();
    }

    function drawOps(ctx, ops) {
      for (const op of ops) {
        if (op.t === 'rect') {
          ctx.fillStyle = op.c;
          roundRectPath(ctx, op.x, op.y, op.w, op.h, op.r);
          ctx.fill();
        } else if (op.t === 'stroke') {
          ctx.strokeStyle = op.c;
          ctx.lineWidth = 1;
          roundRectPath(ctx, op.x, op.y, op.w, op.h, op.r);
          ctx.stroke();
        } else if (op.t === 'line') {
          ctx.strokeStyle = op.c;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(op.x1, op.y1 + 0.5);
          ctx.lineTo(op.x2, op.y2 + 0.5);
          ctx.stroke();
        } else if (op.t === 'dot') {
          ctx.beginPath();
          ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
          ctx.fillStyle = op.c;
          ctx.fill();
        } else if (op.t === 'brand') {
          paintBrand(ctx, op.x, op.y, op.h, op.ink, op.badge);
        } else if (op.t === 'text') {
          ctx.font = op.f;
          ctx.fillStyle = op.c;
          ctx.fillText(op.s, op.x, op.y);
        }
      }
    }

    function measureTextWidth(measure, text, font) {
      measure.font = font;
      return measure.measureText(text).width;
    }

    /** Lay out parsed markdown at the origin so callers can place or box it. */
    function renderBlocks(text, width, measure, theme) {
      const ops = [];
      const height = layoutMessageBlocks(ops, parseBlocks(text), 0, 0, width, measure, theme);
      return { ops, height };
    }

    function naturalContentWidth(content, measure) {
      // Rich text emits one op per token, so measure per baseline row.
      const rows = new Map();
      for (const op of content.ops) {
        if (op.t === 'text') {
          const row = op.y;
          const end = op.x + measureTextWidth(measure, op.s, op.f);
          rows.set(row, Math.max(rows.get(row) === undefined ? 0 : rows.get(row), end));
        } else if (op.t === 'rect' || op.t === 'stroke') {
          rows.set('box', Math.max(rows.get('box') === undefined ? 0 : rows.get('box'), op.x + op.w));
        } else if (op.t === 'line') {
          rows.set('line', Math.max(rows.get('line') === undefined ? 0 : rows.get('line'), op.x2));
        }
      }
      let width = 0;
      for (const value of rows.values()) {
        width = Math.max(width, value);
      }
      return width;
    }

    function shiftOps(target, ops, dx, dy) {
      for (const op of ops) {
        if (op.x !== undefined) op.x += dx;
        if (op.y !== undefined) op.y += dy;
        if (op.x1 !== undefined) {
          op.x1 += dx;
          op.x2 += dx;
          op.y1 += dy;
          op.y2 += dy;
        }
        target.push(op);
      }
    }

    function buildLayout(options) {
      const measure = measureContext();
      const ops = [];
      const width = CARD.width;
      const pad = CARD.pad;
      const contentWidth = width - pad * 2;
      const left = pad;
      const right = width - pad;
      let y = 32;

      // Official brand lockup on the left, date on the right.
      const lockupHeight = 18;
      ops.push({ t: 'brand', x: left, y, h: lockupHeight, ink: COLORS.ink, badge: '#ffffff' });
      const dateFont = '12px ' + SANS;
      const dateWidth = measureTextWidth(measure, options.dateText, dateFont);
      ops.push({
        t: 'text',
        s: options.dateText,
        x: right - dateWidth,
        y: y + 17,
        f: dateFont,
        c: COLORS.meta,
      });

      y += lockupHeight + 18;
      ops.push({ t: 'line', x1: left, y1: y, x2: right, y2: y, c: COLORS.divider });
      y += 26;

      let truncated = false;
      for (const message of options.messages) {
        if (y > CARD.maxHeight - 320) {
          truncated = true;
          break;
        }
        if (message.role === 'user') {
          const maxBubble = Math.round(contentWidth * 0.8);
          const bubblePadX = 16;
          const bubblePadY = 12;
          const content = renderBlocks(
            message.text,
            maxBubble - bubblePadX * 2,
            measure,
            BUBBLE_THEME,
          );
          const natural = naturalContentWidth(content, measure);
          const bubbleWidth = Math.min(
            maxBubble,
            Math.max(120, Math.ceil(natural + bubblePadX * 2)),
          );
          const bubbleHeight = Math.ceil(content.height + bubblePadY * 2);
          const bubbleX = right - bubbleWidth;
          ops.push({
            t: 'rect',
            x: bubbleX,
            y,
            w: bubbleWidth,
            h: bubbleHeight,
            r: 14,
            c: CARD.brand,
          });
          shiftOps(ops, content.ops, bubbleX + bubblePadX, y + bubblePadY);
          y += bubbleHeight + 24;
        } else {
          const content = renderBlocks(message.text, contentWidth, measure);
          shiftOps(ops, content.ops, left, y);
          y += content.height + 26;
        }
      }

      if (truncated) {
        const font = '12.5px ' + SANS;
        const lines = wrapText(measure, options.truncatedNote, contentWidth - 32, font);
        const height = lines.length * 19 + 22;
        ops.push({ t: 'rect', x: left, y, w: contentWidth, h: height, r: 10, c: COLORS.warnBg });
        ops.push({
          t: 'stroke',
          x: left,
          y,
          w: contentWidth,
          h: height,
          r: 10,
          c: COLORS.warnBorder,
        });
        emitLines(ops, lines, left + 16, y + 11, font, COLORS.warnText, 19, 13.5);
        y += height + 16;
      }

      // Footer: the lockup again at a smaller size.
      y += 12;
      ops.push({ t: 'line', x1: left, y1: y, x2: right, y2: y, c: COLORS.divider });
      y += 16;
      const footerLockup = 12;
      ops.push({ t: 'brand', x: left, y, h: footerLockup, ink: COLORS.ink, badge: '#ffffff' });
      ops.push({
        t: 'text',
        s: options.disclaimer,
        x: left,
        y: y + footerLockup + 13,
        f: '10.5px ' + SANS,
        c: COLORS.meta,
      });
      const countFont = '11px ' + SANS;
      const countWidth = measureTextWidth(measure, options.metaText, countFont);
      ops.push({
        t: 'text',
        s: options.metaText,
        x: right - countWidth,
        y: y + 12,
        f: countFont,
        c: COLORS.meta,
      });
      y += footerLockup + 13 + 6;

      y += 30;

      return { ops, height: Math.ceil(y + 48), width, truncated };
    }

    function dataUrlToBlob(dataUrl) {
      const comma = dataUrl.indexOf(',');
      const head = dataUrl.slice(0, comma);
      const body = dataUrl.slice(comma + 1);
      const mime = /data:([^;]+)/.exec(head);
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mime === null ? 'image/png' : mime[1] });
    }

    function timestampSuffix(date) {
      const pad2 = (value) => String(value).padStart(2, '0');
      return (
        date.getFullYear() +
        pad2(date.getMonth() + 1) +
        pad2(date.getDate()) +
        '-' +
        pad2(date.getHours()) +
        pad2(date.getMinutes())
      );
    }

    function renderShareImage(options) {
      const layout = buildLayout(options);
      const scale = layout.height <= 16000 / 3 ? 3 : layout.height <= 8000 ? 2 : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(layout.width * scale);
      canvas.height = Math.round(layout.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, layout.width, layout.height);
      drawOps(ctx, layout.ops);

      const dataUrl = canvas.toDataURL('image/png');
      const now = new Date();
      return {
        dataUrl,
        blob: dataUrlToBlob(dataUrl),
        width: Math.round(layout.width * scale),
        height: Math.round(layout.height * scale),
        fileName: 'conversation-' + timestampSuffix(now) + '.png',
        truncated: layout.truncated,
      };
    }

    /* ------------------------------------------------------------------ *
     * Shared preview state (button opens, overlay renders)
     * ------------------------------------------------------------------ */

    const shareState = {
      open: false,
      stage: 'select',
      entries: [],
      selected: [],
      title: '',
      hasMore: false,
      view: null,
      error: null,
      notice: null,
    };
    const shareListeners = new Set();
    let noticeTimer = null;

    function setShareState(patch) {
      Object.assign(shareState, patch);
      for (const listener of [...shareListeners]) {
        try {
          listener();
        } catch (error) {
          console.error('[share-image] listener failed', error);
        }
      }
    }

    function useShareState() {
      const [, setRevision] = React.useState(0);
      React.useEffect(() => {
        const listener = () => setRevision((value) => value + 1);
        shareListeners.add(listener);
        return () => {
          shareListeners.delete(listener);
        };
      }, []);
      return shareState;
    }

    function openPicker(entries, selectedIds, hasMore, title) {
      setShareState({
        open: true,
        stage: 'select',
        entries,
        selected: selectedIds,
        title,
        hasMore,
        view: null,
        error: null,
        notice: hasMore ? translate('dialog.partial') : null,
      });
    }

    function closePreview() {
      if (noticeTimer !== null) {
        clearTimeout(noticeTimer);
        noticeTimer = null;
      }
      setShareState({
        open: false,
        stage: 'select',
        entries: [],
        selected: [],
        title: '',
        hasMore: false,
        view: null,
        error: null,
        notice: null,
      });
    }

    function toggleSelection(id) {
      const selected = shareState.selected.includes(id)
        ? shareState.selected.filter((value) => value !== id)
        : shareState.selected.concat([id]);
      setShareState({ selected, error: null });
    }

    function selectEveryEntry() {
      setShareState({ selected: shareState.entries.map((entry) => entry.id), error: null });
    }

    function selectNoEntry() {
      setShareState({ selected: [], error: null });
    }

    function backToSelection() {
      setShareState({
        stage: 'select',
        view: null,
        error: null,
        notice: shareState.hasMore ? translate('dialog.partial') : null,
      });
    }

    function generatePreview() {
      const messages = mergeSelection(shareState.entries, shareState.selected);
      if (messages.length === 0) {
        setShareState({ error: translate('select.empty') });
        return;
      }
      try {
        const view = renderShareImage({
          dateText: new Intl.DateTimeFormat(localeReader(), {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }).format(new Date()),
          metaText: translate('card.messages', { count: messages.length }),
          disclaimer: translate('card.disclaimer'),
          truncatedNote: translate('card.truncated'),
          messages,
        });
        setShareState({ stage: 'preview', view, error: null, notice: null });
      } catch (error) {
        console.error('[share-image] rendering failed', error);
        setShareState({ error: String(error) });
      }
    }

    function flashNotice(text) {
      if (noticeTimer !== null) clearTimeout(noticeTimer);
      setShareState({ notice: text });
      noticeTimer = setTimeout(() => {
        noticeTimer = null;
        setShareState({ notice: null });
      }, 2400);
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const CSS =
      '.dsh-shareimg-msgbtn{width:28px;height:28px;border-radius:6px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;padding:6px;cursor:pointer;flex:none}' +
      '.dsh-shareimg-msgbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}' +
      '.dsh-shareimg-msgbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-msgbtn svg{width:17px;height:17px}' +
      '.dsh-shareimg-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,12,16,.55);pointer-events:auto;overscroll-behavior:contain}' +
      '.dsh-shareimg-panel{width:min(960px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;overflow:hidden;border-radius:18px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);box-shadow:0 28px 72px rgba(0,0,0,.38);color:var(--dsw-alias-label-primary);animation:dsh-shareimg-panel-in .18s cubic-bezier(.2,.8,.3,1)}' +
      '@keyframes dsh-shareimg-panel-in{from{opacity:0;transform:translateY(8px) scale(.996)}to{opacity:1;transform:none}}' +
      '.dsh-shareimg-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}' +
      '.dsh-shareimg-mark{width:32px;height:32px;border-radius:9px;background:#4d6bfe;color:#ffffff;display:grid;place-items:center;flex:none}' +
      '.dsh-shareimg-mark svg{width:20px;height:20px}' +
      '.dsh-shareimg-headtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}' +
      '.dsh-shareimg-title{font-size:14px;font-weight:600;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dsh-shareimg-subtitle{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dsh-shareimg-close{width:28px;height:28px;border-radius:8px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:grid;place-items:center;cursor:pointer;flex:none}' +
      '.dsh-shareimg-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}' +
      '.dsh-shareimg-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-select{display:flex;flex-direction:column;flex:1;min-height:0}' +
      '.dsh-shareimg-toolbar{display:flex;align-items:center;gap:6px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-count{flex:1;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.dsh-shareimg-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary);font-size:12px;font-weight:500;line-height:18px;cursor:pointer;padding:3px 7px;border-radius:6px;white-space:nowrap}' +
      '.dsh-shareimg-link:hover{background:var(--dsw-alias-bg-layer-1)}' +
      '.dsh-shareimg-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      '.dsh-shareimg-list{overflow:auto;padding:8px;display:flex;flex-direction:column;gap:2px;flex:1;min-height:0}' +
      '.dsh-shareimg-row{display:flex;align-items:flex-start;gap:12px;padding:10px 10px;border-radius:9px;cursor:pointer}' +
      '.dsh-shareimg-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-check{appearance:none;-webkit-appearance:none;width:18px;height:18px;margin:0;border-radius:6px;border:1.5px solid var(--dsw-alias-border-l2);background:transparent;flex:none;cursor:pointer;position:relative;transition:background .12s,border-color .12s}' +
      '.dsh-shareimg-check:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dsh-shareimg-check:checked{background-color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M3.5 8.5l3 3 6-7\' fill=\'none\' stroke=\'%23ffffff\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;background-size:12px 12px}' +
      '.dsh-shareimg-check:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}' +
      '.dsh-shareimg-rowrole{font-size:11px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-secondary);flex:none;min-width:52px;padding-top:1px}' +
      '.dsh-shareimg-row[data-role=user] .dsh-shareimg-rowrole{color:var(--dsw-alias-brand-primary)}' +
      '.dsh-shareimg-rowtext{font-size:13px;line-height:19px;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}' +
      '.dsh-shareimg-body{overflow:auto;padding:18px;background:var(--dsw-alias-bg-layer-2);flex:1;min-height:0;display:flex;justify-content:center;align-items:flex-start}' +
      '.dsh-shareimg-image{display:block;max-width:min(100%,480px);height:auto;border-radius:12px;box-shadow:0 10px 32px rgba(0,0,0,.20)}' +
      '.dsh-shareimg-foot{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap;background:var(--dsw-alias-bg-layer-1)}' +
      '.dsh-shareimg-status{flex:1;min-width:120px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}' +
      '.dsh-shareimg-status[data-tone=error]{color:var(--dsw-alias-state-error-primary)}' +
      '.dsh-shareimg-action{height:34px;padding:0 15px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .12s}' +
      '.dsh-shareimg-action:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}' +
      '.dsh-shareimg-action:disabled{opacity:.45;cursor:default}' +
      '.dsh-shareimg-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}' +
      '.dsh-shareimg-action[data-variant=primary]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,.12)}' +
      '.dsh-shareimg-action[data-variant=primary]:hover:not(:disabled){filter:brightness(1.06)}';

    /* ------------------------------------------------------------------ *
     * Header action
     * ------------------------------------------------------------------ */

    function ShareGlyph() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', 'aria-hidden': true, focusable: false },
        h('rect', {
          x: 1.8,
          y: 2.8,
          width: 12.4,
          height: 9.4,
          rx: 2.2,
          stroke: 'currentColor',
          strokeWidth: 1.3,
        }),
        h('circle', { cx: 5.3, cy: 6.1, r: 1.05, fill: 'currentColor' }),
        h('path', {
          d: 'M2.9 11.1l3-3 2.4 2.4 1.9-1.9 2.7 2.7',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    function WhaleGlyph() {
      return h(
        'svg',
        { viewBox: '-4 -4 58 58', width: 22, height: 22, 'aria-hidden': true, focusable: false },
        h('path', { d: WHALE_PATH, fill: 'currentColor' }),
      );
    }

    /** Per-message entry: preselects this answer and the question that led to it. */
    function ShareMessageAction(props) {
      const t = typeof props.t === 'function' ? props.t : translate;
      const useChat = typeof props.useChat === 'function' ? props.useChat : noopUseChat;
      const useSessions = typeof props.useSessions === 'function' ? props.useSessions : noopUseSessions;
      const useSession = typeof props.useSession === 'function' ? props.useSession : noopUseSession;
      const sessionId = props.sessionId;
      const messageId = typeof props.messageId === 'string' ? props.messageId : null;

      const nodes = useChat((snapshot) =>
        snapshot !== null && snapshot !== undefined && snapshot.legacy !== undefined
          ? snapshot.legacy.nodes
          : EMPTY_NODES,
      );
      const sessionTitle = useSessions((snapshot) => {
        const entry =
          snapshot !== null && snapshot !== undefined && snapshot.byId !== undefined
            ? snapshot.byId[sessionId]
            : undefined;
        const title = entry !== null && entry !== undefined ? entry.title : undefined;
        return typeof title === 'string' ? title : '';
      });
      const hasMoreHistory = useSession((snapshot) =>
        snapshot !== null && snapshot !== undefined && snapshot.hasMore === true,
      );

      const entries = collectMessages(nodes, {
        image: t('card.image'),
        file: t('card.file'),
      });
      let index = -1;
      if (messageId !== null) {
        index = entries.findIndex(
          (entry) => entry.role === 'assistant' && entry.messageIds.includes(messageId),
        );
      }
      if (index === -1) return null;

      const preselect = [entries[index].id];
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        if (entries[cursor].role === 'user') {
          preselect.push(entries[cursor].id);
          break;
        }
      }

      const onShare = () => {
        openPicker(entries, preselect, hasMoreHistory, cardTitle(sessionTitle, t));
      };

      return h(
        React.Fragment,
        null,
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-shareimg-msgbtn',
            title: t('action.shareMessage'),
            'aria-label': t('action.shareMessage'),
            onClick: onShare,
          },
          h(ShareGlyph),
        ),
      );
    }

    /* ------------------------------------------------------------------ *
     * Preview overlay
     * ------------------------------------------------------------------ */

    function downloadView(view) {
      const anchor = document.createElement('a');
      anchor.href = view.dataUrl;
      anchor.download = view.fileName;
      anchor.rel = 'noopener';
      anchor.click();
    }

    async function copyView(view, t) {
      try {
        if (
          typeof navigator === 'undefined' ||
          navigator.clipboard === undefined ||
          typeof ClipboardItem === 'undefined'
        ) {
          throw new Error('clipboard image write is unavailable');
        }
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': view.blob })]);
        flashNotice(t('dialog.copied'));
        setShareState({ error: null });
      } catch (error) {
        console.error('[share-image] copy failed', error);
        setShareState({ error: t('dialog.copyFailed') });
      }
    }

    function ShareOverlay(props) {
      const t = typeof props.t === 'function' ? props.t : translate;
      const state = useShareState();
      const rootRef = React.useRef(null);
      const closeRef = React.useRef(null);
      const open = state.open;
      const stage = state.stage;

      React.useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closePreview();
            return;
          }
          if (event.key !== 'Tab') return;
          const root = rootRef.current;
          if (root === null) return;
          const focusable = root.querySelectorAll('button, input');
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener('keydown', onKeyDown, true);
        const timer = setTimeout(() => {
          if (closeRef.current !== null) closeRef.current.focus();
        }, 30);
        return () => {
          document.removeEventListener('keydown', onKeyDown, true);
          clearTimeout(timer);
        };
      }, [open, stage]);

      if (!open) return null;

      const view = state.view;
      const selectStage = stage !== 'preview' || view === null;
      const selected = new Set(state.selected);
      const statusNode = h(
        'div',
        {
          className: 'dsh-shareimg-status',
          'data-tone': state.error !== null ? 'error' : undefined,
          role: 'status',
          'aria-live': 'polite',
        },
        state.error !== null ? state.error : state.notice !== null ? state.notice : '',
      );

      const body = selectStage
        ? h(
            'div',
            { className: 'dsh-shareimg-select' },
            h(
              'div',
              { className: 'dsh-shareimg-toolbar' },
              h(
                'span',
                { className: 'dsh-shareimg-count' },
                t('select.count', {
                  selected: state.selected.length,
                  total: state.entries.length,
                }),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-shareimg-link',
                  onClick: selectEveryEntry,
                },
                t('select.all'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-shareimg-link',
                  onClick: selectNoEntry,
                },
                t('select.none'),
              ),
            ),
            h(
              'div',
              { className: 'dsh-shareimg-list' },
              state.entries.map((entry) =>
                h(
                  'label',
                  {
                    key: entry.id,
                    className: 'dsh-shareimg-row',
                    'data-role': entry.role,
                  },
                  h('input', {
                    type: 'checkbox',
                    className: 'dsh-shareimg-check',
                    checked: selected.has(entry.id),
                    onChange: () => toggleSelection(entry.id),
                  }),
                  h(
                    'span',
                    { className: 'dsh-shareimg-rowrole' },
                    entry.role === 'user' ? t('card.you') : t('card.assistant'),
                  ),
                  h('span', { className: 'dsh-shareimg-rowtext' }, previewText(entry.text)),
                ),
              ),
            ),
          )
        : h(
            'div',
            { className: 'dsh-shareimg-body' },
            h('img', {
              className: 'dsh-shareimg-image',
              src: view.dataUrl,
              alt: t('dialog.preview'),
              width: view.width,
              height: view.height,
            }),
          );

      const footer = selectStage
        ? h(
            'div',
            { className: 'dsh-shareimg-foot' },
            statusNode,
            h(
              'button',
              { type: 'button', className: 'dsh-shareimg-action', onClick: closePreview },
              t('select.cancel'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-shareimg-action',
                'data-variant': 'primary',
                disabled: state.selected.length === 0,
                onClick: generatePreview,
              },
              t('select.generate'),
            ),
          )
        : h(
            'div',
            { className: 'dsh-shareimg-foot' },
            statusNode,
            h(
              'button',
              { type: 'button', className: 'dsh-shareimg-action', onClick: backToSelection },
              t('preview.back'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-shareimg-action',
                onClick: () => {
                  void copyView(view, t);
                },
              },
              t('dialog.copy'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-shareimg-action',
                'data-variant': 'primary',
                onClick: () => downloadView(view),
              },
              t('dialog.download'),
            ),
          );

      return h(
        React.Fragment,
        null,
        h(
          'div',
          {
            className: 'dsh-shareimg-backdrop',
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) closePreview();
            },
          },
          h(
            'div',
            {
              className: 'dsh-shareimg-panel',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': selectStage ? t('select.title') : t('dialog.preview'),
              ref: rootRef,
            },
            h(
              'div',
              { className: 'dsh-shareimg-head' },
              h('div', { className: 'dsh-shareimg-mark', 'aria-hidden': true }, h(WhaleGlyph)),
              h(
                'div',
                { className: 'dsh-shareimg-headtext' },
                h(
                  'div',
                  { className: 'dsh-shareimg-title' },
                  selectStage ? t('select.title') : t('dialog.title'),
                ),
                state.title !== ''
                  ? h('div', { className: 'dsh-shareimg-subtitle' }, state.title)
                  : null,
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-shareimg-close',
                  'aria-label': t('dialog.close'),
                  title: t('dialog.close'),
                  ref: closeRef,
                  onClick: closePreview,
                },
                h(
                  'svg',
                  { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': true },
                  h('path', {
                    d: 'M4 4l8 8M12 4l-8 8',
                    stroke: 'currentColor',
                    strokeWidth: 1.5,
                    strokeLinecap: 'round',
                  }),
                ),
              ),
            ),
            body,
            footer,
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ *
     * Plugin entry
     * ------------------------------------------------------------------ */

    let localeReader = () => 'en';

    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.setAttribute('data-share-image', '');
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, 'conversation-share-image: styles');

      const bound = ctx.locale.bind(NS);
      translate = (key, params) => {
        try {
          return bound(key, params);
        } catch (error) {
          return key;
        }
      };
      localeReader = () => {
        try {
          const snapshot = ctx.locale.getLocale();
          return (snapshot !== null && snapshot !== undefined && snapshot.active) || 'en';
        } catch (error) {
          return 'en';
        }
      };

      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            en: {
              'action.shareMessage': 'Share this reply as image',
              'select.title': 'Choose messages to share',
              'select.all': 'Select all',
              'select.none': 'Clear',
              'select.count': '{selected} of {total} selected',
              'select.generate': 'Create image',
              'select.cancel': 'Cancel',
              'select.empty': 'Choose at least one message.',
              'preview.back': 'Back to selection',
              'dialog.title': 'Share as image',
              'dialog.download': 'Download PNG',
              'dialog.copy': 'Copy image',
              'dialog.close': 'Close',
              'dialog.copied': 'Image copied',
              'dialog.copyFailed': "Couldn't copy the image. Download it instead.",
              'dialog.preview': 'Conversation image preview',
              'dialog.partial':
                "Older messages aren't loaded in this view yet, so the image starts partway through the conversation.",
              'card.defaultTitle': 'Conversation',
              'card.messages': '{count} messages',
              'card.you': 'You',
              'card.assistant': 'Assistant',
              'card.image': 'Image',
              'card.file': 'File',
              'card.disclaimer': 'AI-generated content may contain mistakes.',
              'card.truncated':
                'Long conversation: only the most recent messages fit in one image.',
            },
            zh: {
              'action.shareMessage': '\u628a\u8fd9\u6761\u56de\u590d\u5206\u4eab\u4e3a\u56fe\u7247',
              'select.title': '\u9009\u62e9\u8981\u5206\u4eab\u7684\u6d88\u606f',
              'select.all': '\u5168\u9009',
              'select.none': '\u5168\u4e0d\u9009',
              'select.count': '\u5df2\u9009 {selected} / {total}',
              'select.generate': '\u751f\u6210\u56fe\u7247',
              'select.cancel': '\u53d6\u6d88',
              'select.empty': '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u6761\u6d88\u606f\u3002',
              'preview.back': '\u8fd4\u56de\u9009\u62e9',
              'dialog.title': '\u5206\u4eab\u4e3a\u56fe\u7247',
              'dialog.download': '\u4e0b\u8f7d PNG',
              'dialog.copy': '\u590d\u5236\u56fe\u7247',
              'dialog.close': '\u5173\u95ed',
              'dialog.copied': '\u56fe\u7247\u5df2\u590d\u5236',
              'dialog.copyFailed':
                '\u590d\u5236\u56fe\u7247\u5931\u8d25\uff0c\u8bf7\u6539\u4e3a\u4e0b\u8f7d\u3002',
              'dialog.preview': '\u5bf9\u8bdd\u56fe\u7247\u9884\u89c8',
              'dialog.partial':
                '\u5f53\u524d\u89c6\u56fe\u5c1a\u672a\u52a0\u8f7d\u66f4\u65e9\u7684\u6d88\u606f\uff0c\u56e0\u6b64\u56fe\u7247\u4ece\u5bf9\u8bdd\u4e2d\u6bb5\u5f00\u59cb\u3002',
              'card.defaultTitle': '\u5bf9\u8bdd',
              'card.messages': '{count} \u6761\u6d88\u606f',
              'card.you': '\u4f60',
              'card.assistant': '\u52a9\u624b',
              'card.image': '\u56fe\u7247',
              'card.file': '\u6587\u4ef6',
              'card.disclaimer': '\u5185\u5bb9\u7531 AI \u751f\u6210\uff0c\u8bf7\u81ea\u884c\u6838\u5b9e\u3002',
              'card.truncated':
                '\u5bf9\u8bdd\u8fc7\u957f\uff0c\u4e00\u5f20\u56fe\u7247\u53ea\u5bb9\u7eb3\u4e86\u6700\u8fd1\u7684\u6d88\u606f\u3002',
            },
          }),
        'conversation-share-image: copy dictionaries',
      );

      ctx.slots.inject('conversation.chat.assistant-actions', () =>
        ctx.slots.register(
          {
            name: 'conversation.chat.assistant-actions',
            id: 'share-image-message',
            order: 5,
            locale: NS,
          },
          ShareMessageAction,
        ),
      );

      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'share-image-preview',
            order: 300,
            locale: NS,
          },
          ShareOverlay,
        ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    };
  },
});
