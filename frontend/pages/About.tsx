
import React from 'react';
import { Database, Share2, Globe, ShieldCheck, Layers, Cpu, FileJson, Users, Eye, Shield } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="inline-block px-4 py-1.5 rounded-full bg-marine-100 dark:bg-marine-900 text-marine-700 dark:text-marine-300 text-sm font-bold uppercase tracking-wide mb-4">
            marine-term-translations
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">About the Project</h1>
        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          A community-driven infrastructure for maintaining and internationalizing marine thesauri.
        </p>
      </div>
      
      <div className="prose prose-slate dark:prose-invert lg:prose-lg mx-auto mb-16">
        <p>
          <strong>Marine Term Translations</strong> is a specialized platform designed to bridge the gap between technical marine science vocabulary and global understanding and was developed with support of <a href="https://emodnet.ec.europa.eu/en/biology" target="_blank" rel="noopener noreferrer" className="text-marine-600 hover:underline font-semibold">EMODnet Biology</a>. 
          It operates on top of the <a href="https://vocab.nerc.ac.uk/" target="_blank" rel="noopener noreferrer" className="text-marine-600 hover:underline font-semibold">NERC Vocabulary Server</a>, 
          allowing domain experts and contributors to provide translations that are scientifically accurate yet accessible.
        </p>
        <p>
          This project is part of the <a href="https://marine-term-translations.github.io/" className="text-marine-600 hover:underline">marine-term-translations</a> initiative, 
          leveraging modern software management practices to automate the maintenance of thesauri content.
        </p>
      </div>

      {/* Platform Architecture Section */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center flex items-center justify-center gap-2">
            <Cpu className="text-marine-500" /> How the Platform Works
        </h2>
        
        <div className="relative">
            {/* Connecting Line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 -z-10 hidden md:block"></div>
            
            <div className="space-y-12">
                {/* Step 1 */}
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="md:w-1/2 md:text-right">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">1. User Authentication</h3>
                        <p className="text-slate-600 dark:text-slate-400">
                            Contributors sign in securely using their <strong>ORCID iD</strong>, ensuring proper attribution 
                            and maintaining a trusted community of translators. ORCID provides single sign-on authentication 
                            and persistent identification.
                        </p>
                    </div>
                    <div className="bg-marine-100 dark:bg-marine-900 p-4 rounded-full border-4 border-white dark:border-slate-900 shadow-sm z-10">
                        <Users size={24} className="text-marine-600 dark:text-marine-400" />
                    </div>
                    <div className="md:w-1/2 md:opacity-0"></div>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="md:w-1/2 md:opacity-0 hidden md:block"></div>
                    <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded-full border-4 border-white dark:border-slate-900 shadow-sm z-10">
                        <Database size={24} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="md:w-1/2">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">2. Term Browsing & Discovery</h3>
                        <p className="text-slate-600 dark:text-slate-400">
                            The platform imports marine terminology from <strong>EMODnet APIs</strong> and the NERC Vocabulary Server.
                            Users can browse, search, and discover terms that need translation in their languages.
                        </p>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="md:w-1/2 md:text-right">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">3. Translation Contribution</h3>
                        <p className="text-slate-600 dark:text-slate-400">
                             Users submit translations through an intuitive web interface. The platform features 
                             <strong> AI-powered suggestions</strong> via OpenRouter API to assist translators, 
                             while maintaining human oversight for accuracy.
                        </p>
                    </div>
                    <div className="bg-teal-100 dark:bg-teal-900 p-4 rounded-full border-4 border-white dark:border-slate-900 shadow-sm z-10">
                        <Globe size={24} className="text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="md:w-1/2 md:opacity-0"></div>
                </div>

                 {/* Step 4 */}
                 <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="md:w-1/2 md:opacity-0 hidden md:block"></div>
                    <div className="bg-amber-100 dark:bg-amber-900 p-4 rounded-full border-4 border-white dark:border-slate-900 shadow-sm z-10">
                        <Shield size={24} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="md:w-1/2">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">4. Quality Control & Reputation</h3>
                        <p className="text-slate-600 dark:text-slate-400">
                            The platform maintains translation quality through a <strong>reputation system</strong>. 
                            Contributors earn reputation points, and the community can appeal or improve translations 
                            through a moderation workflow.
                        </p>
                    </div>
                </div>

                {/* Step 5 */}
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="md:w-1/2 md:text-right">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">5. Data Storage & Persistence</h3>
                        <p className="text-slate-600 dark:text-slate-400">
                             All translations are stored in a <strong>SQLite database</strong> with full audit trails.
                             The self-hosted architecture ensures complete data sovereignty and can be easily backed up or migrated.
                        </p>
                    </div>
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-full border-4 border-white dark:border-slate-900 shadow-sm z-10">
                        <FileJson size={24} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="md:w-1/2 md:opacity-0"></div>
                </div>
            </div>
        </div>
      </div>

      {/* Technology Stack Feature Box */}
      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 mb-16 shadow-lg relative overflow-hidden group">
        <div className="absolute -right-10 -top-10 text-slate-100 dark:text-slate-700 opacity-50 transform rotate-12 transition-transform group-hover:rotate-0 duration-700">
          <Database size={200} />
        </div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-marine-600 text-white text-xs font-bold uppercase tracking-wide mb-4 shadow-sm">
            <Cpu size={14} /> Self-Hosted Architecture
          </div>
          
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Built for Data Sovereignty
          </h2>
          
          <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed mb-6 max-w-2xl">
            This platform is designed to be <strong>self-hosted</strong>, giving organizations complete control over their translation data. 
            The lightweight architecture uses Docker containers and SQLite, making it easy to deploy and maintain.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                      <Database size={16} className="text-marine-500" /> Simple Data Layer
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                      SQLite database provides reliable storage without complex setup, perfect for small to medium deployments.
                  </p>
              </div>
              <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                      <ShieldCheck size={16} className="text-marine-500" /> Full Data Control
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                      All translation data stays in your infrastructure with complete audit trails and easy backup options.
                  </p>
              </div>
              <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                      <Share2 size={16} className="text-marine-500" /> Standards-Based & Downstream Ingestion
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                      Built on W3C standards (SKOS, JSON-LD) so translations can be ingested by downstream systems like the <a href="https://vocab.vliz.be/" target="_blank" rel="noopener noreferrer" className="text-marine-600 dark:text-marine-400 hover:underline font-medium">VLIZ Vocabulary Server</a>.
                  </p>
              </div>
              <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                      <Eye size={16} className="text-marine-500" /> Optional LDES Export
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                      Translations can be exported as Linked Data Event Streams for integration with other systems.
                  </p>
              </div>
          </div>
        </div>
      </div>

      {/* Marine Vocabulary & Data Ecosystem Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-16">
        {/* NVS Authority Card */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wide mb-4">
              Vocabulary Authority
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              <a href="https://vocab.nerc.ac.uk/" target="_blank" rel="noopener noreferrer" className="hover:text-marine-600 dark:hover:text-marine-400 transition-colors">
                NERC Vocabulary Server
              </a>
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              The NVS provides access to curated collections of controlled vocabularies in oceanographic and earth-science domains. Managed by the <strong>British Oceanographic Data Centre (BODC)</strong> and funded by the UK's <strong>Natural Environment Research Council (NERC)</strong>, it serves as the foundational authority from which MTT retrieves standardized concepts for community translation.
            </p>
          </div>
          <div>
            <a 
              href="https://vocab.nerc.ac.uk/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-marine-600 dark:text-marine-400 text-sm font-semibold hover:underline inline-flex items-center gap-1"
            >
              Explore NVS Vocabularies &rarr;
            </a>
          </div>
        </div>

        {/* EMODnet Community Card */}
        <div className="bg-marine-50/50 dark:bg-slate-800/50 border border-marine-200 dark:border-slate-700 rounded-2xl p-8 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-marine-100 dark:bg-marine-900 text-marine-700 dark:text-marine-300 text-xs font-bold uppercase tracking-wide mb-4">
              Marine Science Community
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              <a href="https://emodnet.ec.europa.eu/en/biology" target="_blank" rel="noopener noreferrer" className="hover:text-marine-600 dark:hover:text-marine-400 transition-colors">
                EMODnet Community
              </a>
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              The European Marine Observation and Data Network (<strong>EMODnet Biology</strong>) unifies fragmented marine biodiversity data from across Europe. Multilingual translations produced on MTT enable European data contributors to map local terminologies to common standards, significantly increasing the accessibility and FAIR reuse of marine biodiversity observations.
            </p>
          </div>
          <div>
            <a 
              href="https://emodnet.ec.europa.eu/en/biology" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-marine-600 dark:text-marine-400 text-sm font-semibold hover:underline inline-flex items-center gap-1"
            >
              Learn about EMODnet Biology &rarr;
            </a>
          </div>
        </div>
      </div>

      {/* Partners Logo Strip */}
      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/60 dark:to-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 mb-16 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Partners</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl mx-auto mb-8">
          Developed and maintained in collaboration with leading marine research institutions and data networks.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto items-center">
          {/* VLIZ */}
          <a 
            href="https://www.vliz.be/en" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="h-24 p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-marine-500 dark:hover:border-marine-400 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group"
            title="Flanders Marine Institute (VLIZ)"
          >
            <img 
              src="/vliz-logo.svg" 
              alt="Flanders Marine Institute (VLIZ)" 
              className="max-h-12 w-auto object-contain group-hover:scale-105 transition-transform duration-200" 
            />
          </a>

          {/* EMODnet */}
          <a 
            href="https://emodnet.ec.europa.eu/en/biology" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="h-24 p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-marine-500 dark:hover:border-marine-400 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group"
            title="EMODnet Biology"
          >
            <img 
              src="/emodnet-logo.png" 
              alt="EMODnet Biology" 
              className="max-h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-200 bg-white/90 px-2 py-1 rounded" 
            />
          </a>

          {/* BODC */}
          <a 
            href="https://www.bodc.ac.uk/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="h-24 p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-marine-500 dark:hover:border-marine-400 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group"
            title="British Oceanographic Data Centre (BODC)"
          >
            <img 
              src="/bodc-logo.png" 
              alt="British Oceanographic Data Centre (BODC)" 
              className="max-h-12 w-auto object-contain group-hover:scale-105 transition-transform duration-200" 
            />
          </a>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 text-center border-t border-slate-200 dark:border-slate-800 pt-12">
        <div className="px-4">
          <Globe className="mx-auto h-10 w-10 text-marine-500 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Internationalization</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Providing accurate technical translations in multiple languages to support global collaboration.
          </p>
        </div>
        <div className="px-4">
           <Database className="mx-auto h-10 w-10 text-marine-500 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">FAIR Data</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Making marine vocabulary Findable, Accessible, Interoperable, and Reusable for machines and humans.
          </p>
        </div>
        <div className="px-4">
           <Layers className="mx-auto h-10 w-10 text-marine-500 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Standardization</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Built on W3C standards (SKOS, JSON-LD) to ensure seamless integration with existing infrastructure.
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
