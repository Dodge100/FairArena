
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    siteName?: string;
    twitterCard?: string;
}

export const SEO = ({
    title = 'FairArena - AI-Powered Project Reviewer',
    description = 'FairArena ensures unbiased project evaluations using advanced AI while facilitating seamless team collaboration.',
    image = 'https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png',
    url,
    type = 'website',
    siteName = 'FairArena',
    twitterCard = 'summary_large_image',
}: SEOProps) => {
    const currentUrl = url || window.location.href;
    const fullTitle = title.includes('FairArena') ? title : `${title} | FairArena`;

    return (
        <Helmet>
            {/* Standard Metadata */}
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={currentUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={currentUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:site_name" content={siteName} />

            {/* Twitter */}
            <meta name="twitter:card" content={twitterCard} />
            <meta name="twitter:url" content={currentUrl} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
        </Helmet>
    );
};
