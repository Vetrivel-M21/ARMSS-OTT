class NavVisibilityModel {
  final bool films;
  final bool series;
  final bool live;
  final bool myList;
  final bool comingSoon;
  final bool plans;

  const NavVisibilityModel({
    this.films = true,
    this.series = true,
    this.live = true,
    this.myList = true,
    this.comingSoon = true,
    this.plans = true,
  });

  factory NavVisibilityModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const NavVisibilityModel();
    return NavVisibilityModel(
      films: json['films'] is bool ? json['films'] : true,
      series: json['series'] is bool ? json['series'] : true,
      live: json['live'] is bool ? json['live'] : true,
      myList: json['myList'] is bool ? json['myList'] : true,
      comingSoon: json['comingSoon'] is bool ? json['comingSoon'] : true,
      plans: json['plans'] is bool ? json['plans'] : true,
    );
  }

  Map<String, dynamic> toJson() => {
    'films': films,
    'series': series,
    'live': live,
    'myList': myList,
    'comingSoon': comingSoon,
    'plans': plans,
  };
}
