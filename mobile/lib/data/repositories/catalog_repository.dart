import '../models/title_model.dart';
import '../models/episode_model.dart';
import '../models/display_settings_model.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';

class CatalogRepository {
  List<TitleModel>? _cachedTitles;

  Future<List<TitleModel>> getTitles({bool refresh = false}) async {
    if (_cachedTitles != null && !refresh) {
      return _cachedTitles!;
    }

    try {
      final response = await apiClient.get(ApiConstants.titles);
      if (response.statusCode == 200 && response.data != null) {
        final List list = response.data is List ? response.data : (response.data['titles'] ?? []);
        final seen = <String>{};
        final uniqueList = <TitleModel>[];
        for (final e in list) {
          final t = TitleModel.fromJson(Map<String, dynamic>.from(e));
          if (t.id.isNotEmpty && seen.add(t.id)) {
            uniqueList.add(t);
          }
        }
        _cachedTitles = uniqueList;
        return _cachedTitles!;
      }
    } catch (_) {
      // Offline or network error - gracefully fall back to local rich static catalog
    }

    final staticList = _getStaticTitles();
    final seen = <String>{};
    _cachedTitles = staticList.where((t) => t.id.isNotEmpty && seen.add(t.id)).toList();
    return _cachedTitles!;
  }

  Future<NavVisibilityModel> getNavVisibility() async {
    try {
      final response = await apiClient.get(ApiConstants.settingsLayout);
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data is Map) {
          final settings = data['settings'] is Map ? data['settings'] : data;
          if (settings['navVisibility'] != null) {
            return NavVisibilityModel.fromJson(Map<String, dynamic>.from(settings['navVisibility']));
          }
        }
      }
    } catch (_) {}
    return const NavVisibilityModel();
  }

  Future<TitleModel?> getTitleById(String id) async {
    try {
      final response = await apiClient.get('${ApiConstants.titles}/$id');
      if (response.statusCode == 200 && response.data != null) {
        final title = TitleModel.fromJson(Map<String, dynamic>.from(response.data));
        if (title.kind == 'series' && title.episodes.isEmpty) {
          final eps = await getEpisodes(id);
          if (eps.isNotEmpty) {
            return title.copyWith(episodes: eps);
          }
        }
        return title;
      }
    } catch (_) {}

    final titles = await getTitles();
    try {
      final found = titles.firstWhere((t) => t.id == id);
      if (found.kind == 'series' && found.episodes.isEmpty) {
        final eps = await getEpisodes(id);
        if (eps.isNotEmpty) {
          return found.copyWith(episodes: eps);
        }
      }
      return found;
    } catch (_) {
      return null;
    }
  }

  Future<List<EpisodeModel>> getEpisodes(String titleId) async {
    try {
      final response = await apiClient.get('${ApiConstants.titles}/$titleId/episodes');
      if (response.statusCode == 200 && response.data != null) {
        final List list = response.data['episodes'] as List? ?? [];
        return list.map((e) => EpisodeModel.fromJson(Map<String, dynamic>.from(e))).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<TitleModel>> getTrending() async {
    final titles = await getTitles();
    return titles.where((t) => t.trending).toList();
  }

  Future<List<TitleModel>> getFeatured() async {
    final titles = await getTitles();
    return titles.where((t) => t.featured).toList();
  }

  Future<List<TitleModel>> getTop10() async {
    final titles = await getTitles();
    final ranked = titles.where((t) => t.rank != null).toList();
    ranked.sort((a, b) => (a.rank ?? 99).compareTo(b.rank ?? 99));
    return ranked;
  }

  Future<List<TitleModel>> getLiveChannels() async {
    final titles = await getTitles();
    return titles.where((t) => t.kind == 'live').toList();
  }

  Future<List<TitleModel>> search(String query) async {
    if (query.trim().isEmpty) return [];
    final titles = await getTitles();
    final q = query.toLowerCase().trim();
    final seen = <String>{};
    final matched = <TitleModel>[];
    for (final t in titles) {
      if (t.id.isEmpty || !seen.add(t.id)) continue;
      final inTitle = t.title.toLowerCase().contains(q);
      final inGenre = t.genres.any((g) => g.toLowerCase().contains(q));
      final inKind = t.kind.toLowerCase().contains(q) ||
          t.kind.replaceAll('_', ' ').toLowerCase().contains(q);
      final inCast = t.cast.any((c) => c.name.toLowerCase().contains(q));
      final inDirector = (t.director ?? '').toLowerCase().contains(q);
      if (inTitle || inGenre || inKind || inCast || inDirector) {
        matched.add(t);
      }
    }
    return matched;
  }

  List<TitleModel> _getStaticTitles() {
    return [
      TitleModel(
        id: 'suzhal',
        title: 'Suzhal: The Vortex',
        kind: 'series',
        year: 2022,
        maturity: '16+',
        runtimeMin: 45,
        seasons: 1,
        genres: ['Crime', 'Mystery', 'Thriller'],
        logline: 'During an annual local festival in a small hill town, a micro-tragedy triggers an avalanche of buried secrets.',
        synopsis: 'In the fictitious industrial town of Sambaloor, the daughter of a labour leader goes missing during the Mayana Kollai festival. An investigation by local cops Sakkarai and Regina uncovers a terrifying web of deceit.',
        match: 98,
        badges: ['4K', 'HDR', 'Atmos'],
        language: 'Tamil',
        tone: 'ember',
        featured: true,
        rank: 3,
        trending: true,
        original: true,
        director: 'Bramma & Anucharan M',
        poster: '/posters/suzhal.jpg',
        backdrop: '/backdrops/suzhal.jpg',
        trailer: '/trailers/suzhal.mp4',
        videoUrl: '/trailers/suzhal.mp4',
        cast: [
          CastMember(name: 'Kathir', role: 'Sakkarai'),
          CastMember(name: 'Aishwarya Rajesh', role: 'Nandhini'),
          CastMember(name: 'R. Parthiban', role: 'Shanmugam'),
          CastMember(name: 'Sriya Reddy', role: 'Regina Thomas'),
        ],
        episodes: [
          EpisodeModel(
            id: 'suzhal-s1e1',
            season: 1,
            number: 1,
            title: 'The Disappearance',
            runtime: 48,
            synopsis: 'During festival preparations, a local factory catches fire and a young girl vanishes without a trace.',
          ),
          EpisodeModel(
            id: 'suzhal-s1e2',
            season: 1,
            number: 2,
            title: 'Whispers in Sambaloor',
            runtime: 46,
            synopsis: 'Suspicions rise among the factory workers as Sakkarai finds contradictory clues near the woods.',
          ),
          EpisodeModel(
            id: 'suzhal-s1e3',
            season: 1,
            number: 3,
            title: 'The Deeper Web',
            runtime: 44,
            synopsis: 'Nandhini reveals her sister had been hiding secrets about a local youth network.',
          ),
        ],
        similar: ['vadhandhi'],
      ),
      TitleModel(
        id: 'vadhandhi',
        title: 'Vadhandhi: The Fable of Velonie',
        kind: 'series',
        year: 2022,
        maturity: '16+',
        runtimeMin: 50,
        seasons: 1,
        genres: ['Crime', 'Thriller', 'Drama'],
        logline: 'A dedicated cop becomes obsessed with uncovering the truth behind the murder of an innocent girl wrapped in societal rumours.',
        synopsis: 'SI Vivek leads the investigation into the mysterious murder of eighteen-year-old Velonie. As sensational rumours spread across the town, Vivek must separate truth from fiction.',
        match: 96,
        badges: ['4K', 'HDR', '5.1'],
        language: 'Tamil',
        tone: 'velvet',
        featured: true,
        rank: 4,
        trending: true,
        original: true,
        director: 'Andrew Louis',
        poster: '/posters/vadhandhi.jpg',
        backdrop: '/backdrops/vadhandhi.jpg',
        trailer: '/trailers/vadhandhi.mp4',
        videoUrl: '/trailers/vadhandhi.mp4',
        cast: [
          CastMember(name: 'S. J. Suryah', role: 'SI Vivek'),
          CastMember(name: 'Sanjana', role: 'Velonie'),
          CastMember(name: 'Laila', role: 'Ruby'),
        ],
        episodes: [
          EpisodeModel(
            id: 'vadhandhi-s1e1',
            season: 1,
            number: 1,
            title: 'The Fable Begins',
            runtime: 52,
            synopsis: 'SI Vivek arrives at the crime scene in an isolated estate in the misty hills.',
          ),
          EpisodeModel(
            id: 'vadhandhi-s1e2',
            season: 1,
            number: 2,
            title: 'Rumours Spread',
            runtime: 49,
            synopsis: 'Media sensationalism clouds public perception as Vivek questions Velonie\'s secret acquaintances.',
          ),
        ],
        similar: ['suzhal'],
      ),
      TitleModel(
        id: 'ayali',
        title: 'Ayali',
        kind: 'series',
        year: 2023,
        maturity: '13+',
        runtimeMin: 35,
        seasons: 1,
        genres: ['Drama', 'Social'],
        logline: 'A young village girl challenges age-old oppressive customs by pursuing her dream of becoming a doctor.',
        synopsis: 'In Veerappannai, centuries-old superstition prevents adolescent girls from attending school. Tamizhselvi risks everything to pursue her education.',
        match: 97,
        badges: ['Full HD', 'Tamil'],
        language: 'Tamil',
        tone: 'ember',
        featured: true,
        trending: true,
        original: true,
        director: 'Muthukumar',
        poster: '/posters/ayali.jpg',
        backdrop: '/backdrops/ayali.jpg',
        trailer: '/trailers/ayali.mp4',
        videoUrl: '/trailers/ayali.mp4',
        cast: [
          CastMember(name: 'Abi Nakshathra', role: 'Tamizhselvi'),
          CastMember(name: 'Anumol', role: 'Kuruvammal'),
        ],
        episodes: [
          EpisodeModel(
            id: 'ayali-s1e1',
            season: 1,
            number: 1,
            title: 'The Sacred Vow',
            runtime: 36,
            synopsis: 'Tamizhselvi excels in school while secretly fearing the village tradition that ends her education.',
          ),
        ],
        similar: ['suzhal'],
      ),
      TitleModel(
        id: 'sun_tv',
        title: 'Sun TV HD Live',
        kind: 'live',
        year: 2026,
        maturity: 'U',
        runtimeMin: 0,
        genres: ['Live TV', 'Entertainment'],
        logline: 'Live 24/7 streaming of South India\'s #1 general entertainment network.',
        synopsis: 'Watch Sun TV live in full HD resolution featuring serials, reality competitions, talk shows, and blockbuster movies.',
        badges: ['LIVE 24x7', 'HD'],
        language: 'Tamil',
        tone: 'ember',
        featured: true,
        trending: true,
        poster: '/posters/sun_tv.jpg',
        backdrop: '/backdrops/sun_tv.jpg',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        cast: [],
      ),
      TitleModel(
        id: 'jai_bhim',
        title: 'Jai Bhim',
        kind: 'film',
        year: 2021,
        maturity: '16+',
        runtimeMin: 164,
        genres: ['Legal Drama', 'Crime', 'Drama'],
        logline: 'When a tribal man is arrested for alleged theft and goes missing, his pregnant wife seeks legal assistance.',
        synopsis: 'Advocate Chandru takes on a habeas corpus case for Sengeni, whose husband disappeared from police custody in a village plagued by social injustice.',
        match: 99,
        badges: ['4K', 'HDR', 'Atmos'],
        language: 'Tamil',
        tone: 'ember',
        featured: true,
        rank: 1,
        trending: true,
        original: true,
        director: 'T. J. Gnanavel',
        poster: '/posters/jai_bhim.jpg',
        backdrop: '/backdrops/jai_bhim.jpg',
        trailer: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        cast: [
          CastMember(name: 'Suriya', role: 'Advocate Chandru'),
          CastMember(name: 'Lijomol Jose', role: 'Sengeni'),
          CastMember(name: 'Manikandan', role: 'Rajakannu'),
        ],
        similar: ['asuran', 'viduthalai'],
      ),
      TitleModel(
        id: 'soorarai_pottru',
        title: 'Soorarai Pottru',
        kind: 'film',
        year: 2020,
        maturity: '13+',
        runtimeMin: 153,
        genres: ['Drama', 'Action', 'Biography'],
        logline: 'Nedumaaran Rajangam sets out to make the common man fly and in the process takes on the world\'s most capital-intensive industry.',
        synopsis: 'Inspired by the events of Simplifly Deccan founder G. R. Gopinath, Maara fights bureaucratic red tape and airline monopolies to launch a low-cost carrier.',
        match: 98,
        badges: ['4K', 'HDR', '5.1'],
        language: 'Tamil',
        tone: 'orbit',
        featured: true,
        rank: 2,
        trending: true,
        original: false,
        director: 'Sudha Kongara',
        poster: '/posters/soorarai_pottru.jpg',
        backdrop: '/backdrops/soorarai_pottru.jpg',
        trailer: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        cast: [
          CastMember(name: 'Suriya', role: 'Nedumaaran (Maara)'),
          CastMember(name: 'Aparna Balamurali', role: 'Bommi'),
          CastMember(name: 'Paresh Rawal', role: 'Paresh Goswami'),
        ],
        similar: ['jai_bhim'],
      ),
      TitleModel(
        id: 'asuran',
        title: 'Asuran',
        kind: 'film',
        year: 2019,
        maturity: '18+',
        runtimeMin: 141,
        genres: ['Action', 'Drama', 'Period'],
        logline: 'A peaceful farmer must protect his family and reconcile his violent past after an unjust confrontation with powerful landowners.',
        synopsis: 'Sivasami lives quietly with his family until an escalating conflict forces his younger son to commit an act of vengeance, driving the family into hiding.',
        match: 97,
        badges: ['Full HD', '5.1'],
        language: 'Tamil',
        tone: 'velvet',
        featured: false,
        rank: 5,
        trending: false,
        fresh: true,
        original: false,
        director: 'Vetrimaaran',
        poster: '/posters/asuran.jpg',
        backdrop: '/backdrops/asuran.jpg',
        trailer: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        cast: [
          CastMember(name: 'Dhanush', role: 'Sivasami'),
          CastMember(name: 'Manju Warrier', role: 'Pachaiyammal'),
          CastMember(name: 'Ken Karunas', role: 'Chidambaram'),
        ],
        similar: ['viduthalai', 'jai_bhim'],
      ),
      TitleModel(
        id: 'viduthalai',
        title: 'Viduthalai Part 1',
        kind: 'film',
        year: 2023,
        maturity: '18+',
        runtimeMin: 150,
        genres: ['Crime', 'Thriller', 'Drama'],
        logline: 'A conflicted rookie constable is assigned to a special task force pursuing a revered rebel leader.',
        synopsis: 'Constable Kumaresan joins Operation Ghosthunt in a remote tribal forest, struggling with moral dilemmas between state authority and human empathy.',
        match: 96,
        badges: ['4K', 'Dolby Atmos'],
        language: 'Tamil',
        tone: 'ink',
        featured: false,
        trending: true,
        fresh: true,
        original: true,
        director: 'Vetrimaaran',
        poster: '/posters/viduthalai.jpg',
        backdrop: '/backdrops/viduthalai.jpg',
        trailer: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        cast: [
          CastMember(name: 'Soori', role: 'Kumaresan'),
          CastMember(name: 'Vijay Sethupathi', role: 'Perumal Vaathiyar'),
          CastMember(name: 'Bhavani Sre', role: 'Tamilarasi'),
        ],
        similar: ['asuran', 'suzhal'],
      ),
      TitleModel(
        id: 'armss_news',
        title: 'ARMSS News 24/7',
        kind: 'live',
        year: 2026,
        maturity: 'U',
        runtimeMin: 0,
        genres: ['Live TV', 'News', 'Current Affairs'],
        logline: 'Real-time breaking news, stock tickers, technology updates, and regional coverage.',
        synopsis: 'ARMSS News 24/7 brings non-stop verified reporting from Tamil Nadu, national events, and international bureaus.',
        badges: ['LIVE 24x7', 'Ultra HD'],
        language: 'Tamil',
        tone: 'ember',
        featured: true,
        trending: true,
        original: true,
        poster: '/posters/armss_news.jpg',
        backdrop: '/backdrops/armss_news.jpg',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        cast: [],
      ),
    ];
  }
}

final catalogRepository = CatalogRepository();
