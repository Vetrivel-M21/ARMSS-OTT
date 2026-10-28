import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../providers/catalog_provider.dart';
import '../../common/poster_card.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();

  final List<String> _popularSearches = [
    'Action',
    'Trending Now',
    'Series',
    'New Releases',
    'Live TV',
    'Blockbusters',
  ];

  final List<String> _genres = [
    'Action',
    'Thriller',
    'Drama',
    'Historical',
    'Crime',
    'Live TV',
    'Animation',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearch(String val) {
    ref.read(searchQueryProvider.notifier).state = val;
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(searchQueryProvider);
    final resultsAsync = ref.watch(searchResultsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: Container(
          height: 44,
          decoration: BoxDecoration(
            color: AppColors.surfaceElevated,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: TextField(
            controller: _searchController,
            onChanged: _onSearch,
            style: const TextStyle(color: Colors.white, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Search movies, series, actors, directors...',
              hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
              prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textSecondary, size: 20),
              suffixIcon: query.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, color: AppColors.textSecondary, size: 18),
                      onPressed: () {
                        _searchController.clear();
                        _onSearch('');
                      },
                    )
                  : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),
      ),
      body: query.isEmpty
          ? _buildExploreView()
          : resultsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
              error: (err, st) => Center(child: Text('Error: $err', style: AppTypography.body)),
              data: (results) {
                if (results.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.search_off_rounded, size: 56, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        Text('No results found for "$query"', style: AppTypography.cardTitle),
                        const SizedBox(height: 6),
                        Text('Try searching for another movie, actor, or genre', style: AppTypography.bodySmall),
                      ],
                    ),
                  );
                }

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${results.length} titles found',
                        style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 12),
                      Expanded(
                        child: GridView.builder(
                          physics: const BouncingScrollPhysics(),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            childAspectRatio: 2 / 3.4,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 12,
                          ),
                          itemCount: results.length,
                          itemBuilder: (context, index) {
                            final item = results[index];
                            return PosterCard(
                              title: item,
                              width: double.infinity,
                              onTap: () => context.push('/title/${item.id}'),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }

  Widget _buildExploreView() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Popular Searches', style: AppTypography.sectionTitle()),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _popularSearches.map((term) {
              return ActionChip(
                label: Text(term, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
                backgroundColor: AppColors.surfaceElevated,
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                onPressed: () {
                  _searchController.text = term;
                  _onSearch(term);
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 28),

          Text('Browse Categories', style: AppTypography.sectionTitle()),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _genres.map((genre) {
              return FilterChip(
                label: Text(genre, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
                backgroundColor: AppColors.surfaceElevated,
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                onSelected: (selected) {
                  _searchController.text = genre;
                  _onSearch(genre);
                },
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
