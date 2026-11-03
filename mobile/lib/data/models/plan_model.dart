class PlanModel {
  final String tier;
  final String name;
  final String priceMonthly;
  final String priceAnnual;
  final String resolution;
  final int devices;
  final bool adFree;
  final bool downloads;
  final bool liveSports;
  final bool originals;

  const PlanModel({
    required this.tier,
    required this.name,
    required this.priceMonthly,
    required this.priceAnnual,
    required this.resolution,
    required this.devices,
    required this.adFree,
    required this.downloads,
    required this.liveSports,
    required this.originals,
  });

  factory PlanModel.fromJson(Map<String, dynamic> json) {
    return PlanModel(
      tier: json['tier']?.toString().toLowerCase() ?? 'free',
      name: json['name']?.toString() ?? 'Plan',
      priceMonthly: json['price_monthly']?.toString() ?? '₹0',
      priceAnnual: json['price_annual']?.toString() ?? '₹0',
      resolution: json['resolution']?.toString() ?? '720p HD',
      devices: (json['devices'] as num?)?.toInt() ?? 1,
      adFree: json['ad_free'] == true,
      downloads: json['downloads'] == true,
      liveSports: json['live_sports'] == true,
      originals: json['originals'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'tier': tier,
        'name': name,
        'price_monthly': priceMonthly,
        'price_annual': priceAnnual,
        'resolution': resolution,
        'devices': devices,
        'ad_free': adFree,
        'downloads': downloads,
        'live_sports': liveSports,
        'originals': originals,
      };

  static List<PlanModel> defaultPlans() {
    return const [
      PlanModel(
        tier: 'free',
        name: 'Free Member',
        priceMonthly: '₹0',
        priceAnnual: '₹0',
        resolution: '720p HD',
        devices: 1,
        adFree: false,
        downloads: false,
        liveSports: false,
        originals: false,
      ),
      PlanModel(
        tier: 'standard',
        name: 'Standard Full HD',
        priceMonthly: '₹99/month',
        priceAnnual: '₹79/month',
        resolution: '1080p Full HD',
        devices: 2,
        adFree: true,
        downloads: false,
        liveSports: true,
        originals: true,
      ),
      PlanModel(
        tier: 'premium',
        name: 'Premium VIP 4K',
        priceMonthly: '₹199/month',
        priceAnnual: '₹159/month',
        resolution: '4K Ultra HD + HDR',
        devices: 4,
        adFree: true,
        downloads: true,
        liveSports: true,
        originals: true,
      ),
    ];
  }
}
