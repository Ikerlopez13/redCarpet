import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const TermsOfService: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6 pt-16">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 md:p-10">
                <button
                    onClick={() => navigate(-1)}
                    className="mb-6 text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                >
                    ← {t('privacy.back')}
                </button>

                <h1 className="text-3xl font-bold mb-6 text-gray-900">{t('terms.title')}</h1>
                <p className="text-sm text-gray-500 mb-8">{t('terms.last_updated')}: {new Date().toLocaleDateString()}</p>

                <div className="space-y-6 text-gray-700 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">{t('terms.section1_title')}</h2>
                        <p>{t('terms.section1_content')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">{t('terms.section2_title')}</h2>
                        <p>{t('terms.section2_content')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">{t('terms.section3_title')}</h2>
                        <p>{t('terms.section3_content')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">{t('terms.section4_title')}</h2>
                        <p>{t('terms.section4_content')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">{t('terms.section5_title')}</h2>
                        <p>{t('terms.section5_content')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">{t('terms.section6_title')}</h2>
                        <p>{t('terms.section6_content')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">{t('terms.section7_title')}</h2>
                        <div className="space-y-4">
                            <p>{t('terms.section7_p1')}</p>
                            <ul className="list-disc pl-5 mt-2 space-y-2">
                                {(t('terms.section7_list', { returnObjects: true }) as string[]).map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
